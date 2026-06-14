import { mkdir, rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppConfig } from '../config.ts';
import type { JobView, MediaMetadata, Selection, ProgressSnapshot } from '../types/api.ts';
import type { Job, JobListener, JobResult } from './types.ts';
import { jobId, downloadToken } from '../lib/id.ts';
import { directorySize } from '../lib/disk.ts';
import { safeDownloadName } from '../lib/filename.ts';
import { computeTtlMs } from '../lib/ttl.ts';
import { buildFormatArgs } from '../lib/format.ts';
import { runManaged } from '../lib/proc.ts';
import {
  buildDownloadArgs,
  apiError,
  classifyStderr,
} from '../lib/ytdlp.ts';
import {
  parseProgressLine,
  stageForPostprocessor,
  DOWNLOAD_TEMPLATE,
  POSTPROCESSOR_TEMPLATE,
} from '../lib/progress.ts';

const SWEEP_INTERVAL_MS = 30_000;
const DISK_WATCH_INTERVAL_MS = 3_000;
// If a running job produces no progress output and no file growth for this long, treat it
// as stalled (e.g., YouTube throttling the extraction/download) and fail fast, rather than
// hanging until the much longer job time limit.
const STALL_TIMEOUT_MS = 120_000;
// During a merge, ffmpeg writes the muxed output alongside the still-present source
// streams, so per-job peak disk use is roughly 2x the final size. The watcher only
// guards against disk runaway; the authoritative per-file limit is the post-download
// stat check plus yt-dlp's --max-filesize. Allow merge headroom to avoid false aborts.
const DISK_PEAK_MULTIPLIER = 2.5;

function initialProgress(): ProgressSnapshot {
  return {
    stage: 'preparing',
    indeterminate: true,
    percent: null,
    downloadedBytes: null,
    totalBytes: null,
    speedBytesPerSec: null,
    etaSeconds: null,
    queuePosition: null,
  };
}

async function findOutputFile(dir: string): Promise<{ path: string; size: number } | null> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  let best: { path: string; size: number } | null = null;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.part') || entry.name.endsWith('.ytdl')) continue;
    const path = join(dir, entry.name);
    const size = (await stat(path)).size;
    if (!best || size > best.size) best = { path, size };
  }
  return best;
}

export class JobManager {
  private readonly jobs = new Map<string, Job>();
  private readonly tokens = new Map<string, string>();
  private readonly listeners = new Map<string, Set<JobListener>>();
  private readonly waiting: string[] = [];
  private running = 0;
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    await rm(this.config.tempDir, { recursive: true, force: true });
    await mkdir(this.config.tempDir, { recursive: true });
    this.sweeper = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
  }

  async shutdown(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper);
    for (const job of this.jobs.values()) job.abort.abort();
  }

  async createJob(
    url: string,
    metadata: MediaMetadata,
    selection: Selection,
  ): Promise<{ ok: true; view: JobView } | { ok: false; category: 'too_large' }> {
    const usage = await directorySize(this.config.tempDir);
    if (usage >= this.config.tempBudgetBytes) {
      return { ok: false, category: 'too_large' };
    }

    const id = jobId();
    this.jobUrls.set(id, url);
    const job: Job = {
      id,
      state: 'queued',
      selection,
      metadata,
      progress: initialProgress(),
      error: null,
      result: null,
      dir: join(this.config.tempDir, id),
      abort: new AbortController(),
      createdAt: Date.now(),
      lastProgressAt: Date.now(),
      activeStreams: 0,
      markedExpired: false,
    };
    this.jobs.set(id, job);
    this.waiting.push(id);
    this.updateQueuePositions();
    this.pump();
    return { ok: true, view: this.toView(job) };
  }

  getView(id: string): JobView | null {
    const job = this.jobs.get(id);
    return job ? this.toView(job) : null;
  }

  subscribe(id: string, listener: JobListener): () => void {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) this.listeners.delete(id);
    };
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || job.state === 'completed' || job.state === 'failed' || job.state === 'expired') {
      return false;
    }
    job.abort.abort();
    if (job.state === 'queued') {
      const idx = this.waiting.indexOf(id);
      if (idx >= 0) this.waiting.splice(idx, 1);
      this.fail(job, 'internal');
    }
    return true;
  }

  acquireFile(token: string): { job: Job; result: JobResult } | null {
    const id = this.tokens.get(token);
    if (id === undefined) return null;
    const job = this.jobs.get(id);
    if (!job || !job.result || job.state !== 'completed' || job.markedExpired) return null;
    if (Date.now() >= job.result.expiresAt) return null;
    job.activeStreams += 1;
    return { job, result: job.result };
  }

  releaseFile(job: Job): void {
    job.activeStreams = Math.max(0, job.activeStreams - 1);
    if (job.markedExpired && job.activeStreams === 0) void this.reclaim(job);
  }

  private pump(): void {
    while (this.running < this.config.concurrency && this.waiting.length > 0) {
      const id = this.waiting.shift();
      if (id === undefined) break;
      const job = this.jobs.get(id);
      if (!job || job.state !== 'queued') continue;
      this.running += 1;
      this.updateQueuePositions();
      void this.execute(job).finally(() => {
        this.running -= 1;
        this.pump();
      });
    }
  }

  private async execute(job: Job): Promise<void> {
    if (job.abort.signal.aborted) {
      this.fail(job, 'internal');
      return;
    }
    job.state = 'running';
    job.lastProgressAt = Date.now();
    job.progress = { ...initialProgress(), indeterminate: true, queuePosition: null };
    this.notify(job);

    try {
      await mkdir(job.dir, { recursive: true });
    } catch {
      this.fail(job, 'internal');
      return;
    }

    const { args: formatArgs, expectedExt } = buildFormatArgs(job.selection);
    const args = buildDownloadArgs({
      config: this.config,
      url: this.urlForJob(job),
      formatArgs,
      outputTemplate: join(job.dir, 'media.%(ext)s'),
      downloadTemplate: DOWNLOAD_TEMPLATE,
      postprocessorTemplate: POSTPROCESSOR_TEMPLATE,
    });

    const diskCeiling = this.config.maxFileSizeBytes * DISK_PEAK_MULTIPLIER;
    let lastDiskSize = 0;
    const diskWatch = setInterval(() => {
      void directorySize(job.dir).then((size) => {
        if (job.abort.signal.aborted) return;
        if (size > diskCeiling) {
          job.error = apiError('too_large');
          job.abort.abort();
          return;
        }
        if (size > lastDiskSize) {
          lastDiskSize = size;
          job.lastProgressAt = Date.now();
        }
        if (Date.now() - job.lastProgressAt > STALL_TIMEOUT_MS) {
          job.error = apiError('timeout');
          job.abort.abort();
        }
      });
    }, DISK_WATCH_INTERVAL_MS);

    let result;
    try {
      result = await runManaged(this.config.ytdlpPath, args, {
        timeoutMs: this.config.jobTimeoutMs,
        signal: job.abort.signal,
        onStdoutLine: (line) => this.onLine(job, line),
      });
    } catch {
      clearInterval(diskWatch);
      this.fail(job, 'internal');
      return;
    }
    clearInterval(diskWatch);

    if (job.error?.category === 'too_large') {
      this.fail(job, 'too_large');
      return;
    }
    if (result.timedOut) {
      this.fail(job, 'timeout');
      return;
    }
    if (result.aborted) {
      this.fail(job, 'internal');
      return;
    }
    if (result.code !== 0) {
      this.fail(job, classifyStderr(result.stderr));
      return;
    }

    const output = await findOutputFile(job.dir);
    if (!output) {
      this.fail(job, 'internal');
      return;
    }
    if (output.size > this.config.maxFileSizeBytes) {
      this.fail(job, 'too_large');
      return;
    }

    void expectedExt;
    this.complete(job, output.path, output.size);
  }

  private onLine(job: Job, line: string): void {
    const parsed = parseProgressLine(line);
    if (!parsed) return;
    job.lastProgressAt = Date.now();

    if (parsed.type === 'download') {
      const total = parsed.totalBytes;
      const percent =
        total !== null && total > 0 && parsed.downloadedBytes !== null
          ? Math.min(100, (parsed.downloadedBytes / total) * 100)
          : null;
      job.progress = {
        stage: 'downloading',
        indeterminate: percent === null,
        percent,
        downloadedBytes: parsed.downloadedBytes,
        totalBytes: total,
        speedBytesPerSec: parsed.speedBytesPerSec,
        etaSeconds: parsed.etaSeconds,
        queuePosition: null,
      };
      this.notify(job);
    } else {
      job.progress = {
        ...job.progress,
        stage: stageForPostprocessor(parsed.postprocessor),
        indeterminate: true,
        percent: null,
        speedBytesPerSec: null,
        etaSeconds: null,
        queuePosition: null,
      };
      this.notify(job);
    }
  }

  private complete(job: Job, filePath: string, sizeBytes: number): void {
    const token = downloadToken();
    const ttl = computeTtlMs(
      sizeBytes,
      this.config.ttlMinMs,
      this.config.ttlMaxMs,
      this.config.ttlMsPerByte,
    );
    const filename = safeDownloadName(
      job.metadata.title,
      job.selection.kind === 'audio' ? 'mp3' : 'mp4',
    );
    job.result = {
      token,
      filename,
      filePath,
      sizeBytes,
      expiresAt: Date.now() + ttl,
    };
    job.state = 'completed';
    job.progress = { ...job.progress, stage: job.progress.stage, indeterminate: false, percent: 100 };
    this.tokens.set(token, job.id);
    this.notify(job);
  }

  private fail(job: Job, category: Parameters<typeof apiError>[0]): void {
    if (job.state === 'completed' || job.state === 'failed' || job.state === 'expired') return;
    job.state = 'failed';
    job.error = job.error ?? apiError(category);
    this.notify(job);
    void rm(job.dir, { recursive: true, force: true });
  }

  private async sweep(): Promise<void> {
    const now = Date.now();
    for (const job of this.jobs.values()) {
      if (job.state === 'completed' && job.result && now >= job.result.expiresAt) {
        job.markedExpired = true;
        if (job.activeStreams === 0) await this.reclaim(job);
      }
      if (
        (job.state === 'failed' || job.state === 'expired') &&
        now - job.createdAt > this.config.ttlMaxMs * 2
      ) {
        if (job.result) this.tokens.delete(job.result.token);
        this.jobs.delete(job.id);
      }
    }
  }

  private async reclaim(job: Job): Promise<void> {
    job.state = 'expired';
    if (job.result) this.tokens.delete(job.result.token);
    await rm(job.dir, { recursive: true, force: true });
    this.notify(job);
  }

  private updateQueuePositions(): void {
    this.waiting.forEach((id, index) => {
      const job = this.jobs.get(id);
      if (job && job.state === 'queued') {
        job.progress = { ...job.progress, queuePosition: index + 1 };
        this.notify(job);
      }
    });
  }

  private readonly jobUrls = new Map<string, string>();

  private urlForJob(job: Job): string {
    return this.jobUrls.get(job.id) ?? '';
  }

  private notify(job: Job): void {
    const set = this.listeners.get(job.id);
    if (!set) return;
    for (const listener of set) listener();
  }

  toView(job: Job): JobView {
    return {
      id: job.id,
      state: job.state,
      selection: job.selection,
      metadata: job.metadata,
      progress: job.progress,
      error: job.error,
      result: job.result
        ? {
            token: job.result.token,
            filename: job.result.filename,
            sizeBytes: job.result.sizeBytes,
            expiresAt: job.result.expiresAt,
          }
        : null,
    };
  }
}
