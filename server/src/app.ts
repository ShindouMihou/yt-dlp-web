import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { streamSSE } from 'hono/streaming';
import { serveStatic } from '@hono/node-server/serve-static';
import { getCookie, setCookie } from 'hono/cookie';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import type { AppConfig } from './config.ts';
import type { JobManager } from './jobs/manager.ts';
import type {
  AppConfigResponse,
  ApiError,
  ErrorCategory,
  CreateJobResponse,
  ProbeResponse,
} from './types/api.ts';
import { validateYoutubeUrl } from './lib/url.ts';
import { parseSelection } from './lib/format.ts';
import { probe, apiError } from './lib/ytdlp.ts';
import { SlidingWindowLimiter } from './lib/rateLimit.ts';
import { issueSession, verifySession, passwordMatches } from './lib/session.ts';
import { contentDisposition } from './lib/filename.ts';

const SESSION_COOKIE = 'ytdl4me_session';
const STATIC_ROOT = './public';

function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = c.req.header('x-forwarded-for');
    if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
  }
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming;
  return incoming?.socket?.remoteAddress ?? 'unknown';
}

function isHttps(c: Context, trustProxy: boolean): boolean {
  if (trustProxy && c.req.header('x-forwarded-proto') === 'https') return true;
  return new URL(c.req.url).protocol === 'https:';
}

function err(category: ErrorCategory): ApiError {
  return apiError(category);
}

export function createApp(config: AppConfig, manager: JobManager): Hono {
  const app = new Hono();

  const loginLimiter = new SlidingWindowLimiter(8, 60_000, 60);
  const probeLimiter = new SlidingWindowLimiter(20, 60_000, 200);

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' https://i.ytimg.com https://*.ggpht.com data:; " +
        "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; " +
        "frame-ancestors 'none'; form-action 'self'",
    );
  });

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  const authed = (c: Context): boolean =>
    !config.gateEnabled || verifySession(getCookie(c, SESSION_COOKIE), config.sessionSecret);

  app.get('/api/config', (c) => {
    const body: AppConfigResponse = {
      gateEnabled: config.gateEnabled,
      authenticated: authed(c),
      maxFileSizeBytes: config.maxFileSizeBytes,
    };
    return c.json(body);
  });

  app.post('/api/session', async (c) => {
    if (!config.gateEnabled) return c.json({ ok: true });
    if (!loginLimiter.check(clientIp(c, config.trustProxy))) {
      return c.json({ error: err('busy') }, 429);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: err('internal') }, 400);
    }
    const password = (body as { password?: unknown }).password;
    if (typeof password !== 'string' || config.password === null || !passwordMatches(password, config.password)) {
      return c.json({ error: { category: 'internal', message: 'Incorrect password.' } }, 401);
    }
    setCookie(c, SESSION_COOKIE, issueSession(config.sessionSecret), {
      httpOnly: true,
      sameSite: 'Lax',
      secure: isHttps(c, config.trustProxy),
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    return c.json({ ok: true });
  });

  const gate = async (c: Context, next: Next) => {
    if (!authed(c)) return c.json({ error: { category: 'internal', message: 'Login required.' } }, 401);
    await next();
  };

  app.post('/api/probe', gate, async (c) => {
    if (!probeLimiter.check(clientIp(c, config.trustProxy))) {
      return c.json({ error: err('busy') }, 429);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: err('internal') }, 400);
    }
    const url = (body as { url?: unknown }).url;
    if (typeof url !== 'string') return c.json({ error: err('unsupported') }, 400);

    const valid = validateYoutubeUrl(url);
    if (!valid.ok) return c.json({ error: err('unsupported') }, 400);

    const result = await probe(valid.canonical, config);
    if (!result.ok) return c.json({ error: result.error }, 422);

    const res: ProbeResponse = { metadata: result.metadata };
    return c.json(res);
  });

  app.post('/api/jobs', gate, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: err('internal') }, 400);
    }
    const url = (body as { url?: unknown }).url;
    const selection = parseSelection((body as { selection?: unknown }).selection);
    if (typeof url !== 'string' || selection === null) {
      return c.json({ error: err('unsupported') }, 400);
    }
    const valid = validateYoutubeUrl(url);
    if (!valid.ok) return c.json({ error: err('unsupported') }, 400);

    const result = await probe(valid.canonical, config);
    if (!result.ok) return c.json({ error: result.error }, 422);

    const created = await manager.createJob(valid.canonical, result.metadata, selection);
    if (!created.ok) return c.json({ error: err(created.category) }, 507);

    const res: CreateJobResponse = { job: created.view };
    return c.json(res, 201);
  });

  app.get('/api/jobs/:id', gate, (c) => {
    const view = manager.getView(c.req.param('id') ?? '');
    if (!view) return c.json({ error: err('internal') }, 404);
    return c.json({ job: view });
  });

  app.post('/api/jobs/:id/cancel', gate, (c) => {
    const ok = manager.cancel(c.req.param('id') ?? '');
    return c.json({ ok });
  });

  app.get('/api/jobs/:id/events', gate, (c) => {
    const id = c.req.param('id') ?? '';
    if (!manager.getView(id)) return c.json({ error: err('internal') }, 404);

    return streamSSE(c, async (stream) => {
      let wake: () => void = () => {};
      const unsub = manager.subscribe(id, () => wake());
      try {
        for (;;) {
          const view = manager.getView(id);
          if (!view) break;
          await stream.writeSSE({ event: 'state', data: JSON.stringify(view) });
          if (view.state === 'completed' || view.state === 'failed' || view.state === 'expired') {
            break;
          }
          await new Promise<void>((resolve) => {
            wake = resolve;
            const timer = setTimeout(resolve, 15_000);
            stream.onAbort(() => {
              clearTimeout(timer);
              resolve();
            });
          });
          if (stream.aborted) break;
        }
      } finally {
        unsub();
      }
    });
  });

  app.get('/api/files/:token', gate, (c) => {
    const acquired = manager.acquireFile(c.req.param('token') ?? '');
    if (!acquired) return c.json({ error: err('internal') }, 404);

    const { job, result } = acquired;
    const nodeStream = createReadStream(result.filePath);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      manager.releaseFile(job);
    };
    nodeStream.on('close', release);
    nodeStream.on('error', release);

    c.header('Content-Type', 'application/octet-stream');
    c.header('Content-Length', String(result.sizeBytes));
    c.header('Content-Disposition', contentDisposition(result.filename));
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Cache-Control', 'no-store');
    return c.body(Readable.toWeb(nodeStream) as ReadableStream);
  });

  app.use('/assets/*', serveStatic({ root: STATIC_ROOT }));
  app.get('/favicon.svg', serveStatic({ root: STATIC_ROOT, path: '/favicon.svg' }));
  app.get('/manifest.webmanifest', serveStatic({ root: STATIC_ROOT, path: '/manifest.webmanifest' }));
  app.get('*', serveStatic({ root: STATIC_ROOT, path: '/index.html' }));

  return app;
}

export { STATIC_ROOT };
