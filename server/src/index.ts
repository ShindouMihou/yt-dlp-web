import { serve } from '@hono/node-server';
import { loadConfig } from './config.ts';
import { JobManager } from './jobs/manager.ts';
import { createApp } from './app.ts';

async function main(): Promise<void> {
  const config = loadConfig();
  const manager = new JobManager(config);

  // Startup temp purge MUST finish before the listener binds (no request can race it).
  await manager.init();

  const app = createApp(config, manager);

  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    process.stdout.write(`ytdl4.me listening on http://localhost:${info.port}\n`);
    if (!config.gateEnabled) {
      process.stdout.write('Password gate is DISABLED — do not expose this instance publicly.\n');
    }
  });

  const shutdown = () => {
    void manager.shutdown().finally(() => {
      server.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error: unknown) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
