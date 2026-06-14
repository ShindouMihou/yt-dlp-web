import { z } from 'zod';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MB = 1024 * 1024;

const boolFromEnv = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1' || v === 'yes');

const intFromEnv = (def: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return def;
      const n = Number(v);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: `must be an integer in [${min}, ${max}]` });
        return z.NEVER;
      }
      return n;
    });

const schema = z.object({
  PORT: intFromEnv(8382, 1, 65535),
  YTDL_PASSWORD: z.string().optional(),
  YTDL_SESSION_SECRET: z.string().optional(),
  TRUST_PROXY: boolFromEnv,
  CONCURRENCY: intFromEnv(1, 1, 8),
  TTL_MIN_MINUTES: intFromEnv(30, 1, 1440),
  TTL_MAX_MINUTES: intFromEnv(60, 1, 1440),
  TTL_MINUTES_PER_GB: intFromEnv(20, 1, 600),
  MAX_FILE_SIZE_MB: intFromEnv(2048, 16, 1024 * 100),
  TEMP_BUDGET_MB: intFromEnv(8192, 64, 1024 * 400),
  JOB_TIMEOUT_SECONDS: intFromEnv(1800, 30, 7 * 3600),
  PROBE_TIMEOUT_SECONDS: intFromEnv(45, 5, 600),
  TEMP_DIR: z.string().optional(),
  YTDLP_PATH: z.string().optional(),
  COOKIES_FILE: z.string().optional(),
});

export interface AppConfig {
  port: number;
  password: string | null;
  sessionSecret: string;
  trustProxy: boolean;
  concurrency: number;
  ttlMinMs: number;
  ttlMaxMs: number;
  ttlMsPerByte: number;
  maxFileSizeBytes: number;
  tempBudgetBytes: number;
  jobTimeoutMs: number;
  probeTimeoutMs: number;
  tempDir: string;
  ytdlpPath: string;
  cookiesFile: string | null;
  gateEnabled: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  const e = parsed.data;

  if (e.TTL_MAX_MINUTES < e.TTL_MIN_MINUTES) {
    throw new Error('Invalid configuration: TTL_MAX_MINUTES must be >= TTL_MIN_MINUTES');
  }

  const password = e.YTDL_PASSWORD && e.YTDL_PASSWORD.length > 0 ? e.YTDL_PASSWORD : null;
  const sessionSecret =
    e.YTDL_SESSION_SECRET && e.YTDL_SESSION_SECRET.length > 0
      ? e.YTDL_SESSION_SECRET
      : password
        ? `derived:${password}`
        : 'insecure-no-gate';

  return {
    port: e.PORT,
    password,
    sessionSecret,
    trustProxy: e.TRUST_PROXY,
    concurrency: e.CONCURRENCY,
    ttlMinMs: e.TTL_MIN_MINUTES * 60_000,
    ttlMaxMs: e.TTL_MAX_MINUTES * 60_000,
    ttlMsPerByte: (e.TTL_MINUTES_PER_GB * 60_000) / (1024 * MB),
    maxFileSizeBytes: e.MAX_FILE_SIZE_MB * MB,
    tempBudgetBytes: e.TEMP_BUDGET_MB * MB,
    jobTimeoutMs: e.JOB_TIMEOUT_SECONDS * 1000,
    probeTimeoutMs: e.PROBE_TIMEOUT_SECONDS * 1000,
    tempDir: e.TEMP_DIR && e.TEMP_DIR.length > 0 ? e.TEMP_DIR : join(tmpdir(), 'ytdl4me'),
    ytdlpPath: e.YTDLP_PATH && e.YTDLP_PATH.length > 0 ? e.YTDLP_PATH : 'yt-dlp',
    cookiesFile: e.COOKIES_FILE && e.COOKIES_FILE.length > 0 ? e.COOKIES_FILE : null,
    gateEnabled: password !== null,
  };
}
