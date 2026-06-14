import type { AppConfig } from '../config.ts';
import type { ApiError, MediaMetadata, ErrorCategory } from '../types/api.ts';
import { isAllowedThumbnailHost } from './url.ts';
import { runManaged } from './proc.ts';

export interface ProbeOk {
  ok: true;
  metadata: MediaMetadata;
}
export interface ProbeErr {
  ok: false;
  error: ApiError;
}
export type ProbeResult = ProbeOk | ProbeErr;

const MESSAGES: Record<ErrorCategory, string> = {
  unsupported: 'That link isn’t a supported YouTube or YouTube Music video.',
  unavailable: 'This video isn’t available — it may be private, deleted, or never existed.',
  restricted: 'YouTube is restricting this video (age or region). This page can’t work around that.',
  bot_wall: 'YouTube is asking us to prove we’re not a bot. Ask whoever set this up to help.',
  too_large: 'This download is larger than the size limit set for this server.',
  timeout: 'This took too long and was stopped. Try a shorter or smaller video.',
  busy: 'The server is busy right now — your download will start shortly.',
  internal: 'Something went wrong while processing this. Please try again.',
};

export function apiError(category: ErrorCategory): ApiError {
  return { category, message: MESSAGES[category] };
}

export function classifyStderr(stderr: string): ErrorCategory {
  const s = stderr.toLowerCase();
  if (/sign in to confirm (you|you’re|your).*not a bot|confirm you.?re not a bot|not a bot/.test(s)) {
    return 'bot_wall';
  }
  if (/age.?restricted|inappropriate for some users|confirm your age|sign in to confirm your age/.test(s)) {
    return 'restricted';
  }
  if (/not available in your country|geo.?restrict|blocked it in your country|available in your country/.test(s)) {
    return 'restricted';
  }
  if (/private video|video unavailable|has been removed|account.*terminated|does not exist|removed by the uploader|no longer available/.test(s)) {
    return 'unavailable';
  }
  if (/unsupported url|is not a valid url|none of the available/.test(s)) {
    return 'unsupported';
  }
  return 'internal';
}

function baseArgs(config: AppConfig): string[] {
  const args = ['--ignore-config', '--no-playlist', '--no-warnings'];
  // `=`-joined form so a cookies path is never parsed as a flag (argparse-safe).
  if (config.cookiesFile) args.push(`--cookies=${config.cookiesFile}`);
  return args;
}

interface RawThumbnail {
  url?: unknown;
  preference?: unknown;
  height?: unknown;
}

interface RawFormat {
  height?: unknown;
  vcodec?: unknown;
}

function pickThumbnail(raw: Record<string, unknown>): string | null {
  const direct = raw.thumbnail;
  if (typeof direct === 'string' && isAllowedThumbnailHost(direct)) return direct;

  const thumbs = raw.thumbnails;
  if (Array.isArray(thumbs)) {
    const candidates = (thumbs as RawThumbnail[])
      .filter((t) => typeof t.url === 'string' && isAllowedThumbnailHost(t.url as string))
      .sort((a, b) => Number(b.height ?? 0) - Number(a.height ?? 0));
    const best = candidates[0];
    if (best && typeof best.url === 'string') return best.url;
  }
  return null;
}

function collectHeights(raw: Record<string, unknown>): number[] {
  const formats = raw.formats;
  if (!Array.isArray(formats)) return [];
  const heights = new Set<number>();
  for (const f of formats as RawFormat[]) {
    if (f.vcodec === 'none') continue;
    const h = Number(f.height);
    if (Number.isFinite(h) && h > 0) heights.add(h);
  }
  return [...heights].sort((a, b) => b - a);
}

function normalize(raw: Record<string, unknown>): MediaMetadata {
  const duration = Number(raw.duration);
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    title: typeof raw.title === 'string' && raw.title.length > 0 ? raw.title : 'Untitled',
    uploader:
      typeof raw.uploader === 'string'
        ? raw.uploader
        : typeof raw.channel === 'string'
          ? raw.channel
          : null,
    durationSeconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    thumbnailUrl: pickThumbnail(raw),
    availableHeights: collectHeights(raw),
    isLive: raw.is_live === true,
  };
}

const PROBE_CACHE_TTL_MS = 90_000;
const probeCache = new Map<string, { metadata: MediaMetadata; expires: number }>();

export async function probe(url: string, config: AppConfig): Promise<ProbeResult> {
  const cached = probeCache.get(url);
  if (cached && cached.expires > Date.now()) {
    return { ok: true, metadata: cached.metadata };
  }

  let result;
  try {
    result = await runManaged(
      config.ytdlpPath,
      // player_skip=js avoids the slow n-signature JS challenge during metadata-only
      // probing; we never use the probe's format URLs (the download re-extracts), and
      // the available-format list is unaffected. Keeps the preview fast and avoids hangs.
      [...baseArgs(config), '--extractor-args', 'youtube:player_skip=js', '-J', '--', url],
      { timeoutMs: config.probeTimeoutMs },
    );
  } catch {
    return { ok: false, error: apiError('internal') };
  }

  if (result.timedOut) return { ok: false, error: apiError('timeout') };
  if (result.code !== 0 || result.stdout.trim().length === 0) {
    return { ok: false, error: apiError(classifyStderr(result.stderr)) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return { ok: false, error: apiError('internal') };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: apiError('internal') };
  }
  const raw = parsed as Record<string, unknown>;

  if (raw._type === 'playlist' || Array.isArray(raw.entries)) {
    return {
      ok: false,
      error: {
        category: 'unsupported',
        message: 'That link is a playlist or channel. Please paste a single video link.',
      },
    };
  }

  const metadata = normalize(raw);
  probeCache.set(url, { metadata, expires: Date.now() + PROBE_CACHE_TTL_MS });
  return { ok: true, metadata };
}

export function buildDownloadArgs(params: {
  config: AppConfig;
  url: string;
  formatArgs: string[];
  outputTemplate: string;
  downloadTemplate: string;
  postprocessorTemplate: string;
}): string[] {
  const { config, url, formatArgs, outputTemplate, downloadTemplate, postprocessorTemplate } =
    params;
  return [
    ...baseArgs(config),
    ...formatArgs,
    '--newline',
    '--no-mtime',
    '--restrict-filenames',
    '--no-color',
    // Fail fast on a stalled connection instead of hanging until the job time limit,
    // and parallelize fragmented (HLS/DASH) downloads for speed.
    '--socket-timeout',
    '30',
    '--retries',
    '5',
    '--fragment-retries',
    '5',
    '--concurrent-fragments',
    '4',
    '--progress-template',
    downloadTemplate,
    '--progress-template',
    postprocessorTemplate,
    '--max-filesize',
    String(config.maxFileSizeBytes),
    `--output=${outputTemplate}`,
    '--',
    url,
  ];
}
