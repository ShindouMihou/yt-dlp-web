import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface ManagedProcOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  onStdoutLine?: (line: string) => void;
  maxStderrBytes?: number;
}

export interface ManagedProcResult {
  code: number | null;
  timedOut: boolean;
  aborted: boolean;
  stderr: string;
  stdout: string;
}

const KILL_GRACE_MS = 4000;

export function runManaged(
  command: string,
  args: string[],
  opts: ManagedProcOptions,
): Promise<ManagedProcResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    let stdout = '';
    let timedOut = false;
    let aborted = false;
    let settled = false;
    const maxStderr = opts.maxStderrBytes ?? 64 * 1024;

    const killTree = (signal: NodeJS.Signals) => {
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, signal);
      } catch {
        try {
          child.kill(signal);
        } catch {
          /* already gone */
        }
      }
    };

    const hardKillTimer = setTimeout(() => {
      timedOut = true;
      killTree('SIGTERM');
      setTimeout(() => killTree('SIGKILL'), KILL_GRACE_MS);
    }, opts.timeoutMs);

    const onAbort = () => {
      aborted = true;
      killTree('SIGTERM');
      setTimeout(() => killTree('SIGKILL'), KILL_GRACE_MS);
    };
    if (opts.signal) {
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    if (opts.onStdoutLine && child.stdout) {
      const rl = createInterface({ input: child.stdout });
      rl.on('line', (line) => opts.onStdoutLine?.(line));
    } else if (child.stdout) {
      child.stdout.on('data', (chunk: Buffer) => {
        if (stdout.length < 16 * 1024 * 1024) stdout += chunk.toString('utf8');
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < maxStderr) stderr += chunk.toString('utf8');
      });
    }

    const cleanup = () => {
      clearTimeout(hardKillTimer);
      opts.signal?.removeEventListener('abort', onAbort);
    };

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ code, timedOut, aborted, stderr, stdout });
    });
  });
}
