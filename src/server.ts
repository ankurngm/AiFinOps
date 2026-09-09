/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMiddie from '@fastify/middie';
import type { ViteDevServer } from 'vite';
import { env } from './config/env.js';
import { getProviderReadiness } from './config/providers.js';
import { checkPricingCoverage } from './config/modelPricing.js';
import { pool } from './db/pool.js';
import { chatCompletionsRoute } from './routes/chatCompletions.js';
import { healthRoute } from './routes/health.js';
import { logsRoute } from './routes/logs.js';
import { logsExportRoute } from './routes/logsExport.js';
import { overviewRoute } from './routes/overview.js';

function logProviderReadiness(): void {
  const { ready, notReady } = getProviderReadiness();

  if (ready.length > 0) {
    console.log(`✅ Providers ready: ${ready.join(', ')}`);
  }

  if (ready.length === 0) {
    console.warn(
      '⚠️  No provider is provisioned — no provider API keys were found in the environment. ' +
        'All chat completion requests will fail until at least one provider key is set.',
    );
  } else if (notReady.length > 0) {
    console.warn(
      `⚠️  Listed in config/providers.json but missing their API key (will fail if used): ${notReady.join(', ')}`,
    );
  }
}

function logPricingCoverage(): void {
  const { checksSkipped, missing } = checkPricingCoverage();

  for (const providerName of checksSkipped) {
    console.log(
      `ℹ️  Pricing check is off for "${providerName}" — if any of its models are billed, ` +
        'set requiresPricingCheck: true in config/providers.json.',
    );
  }

  if (missing.length > 0) {
    console.warn(
      `⚠️  No valid pricing entry for: ${missing.join(', ')} — cost will be logged as NULL ` +
        'for these until config/modelPricing.json is updated.',
    );
  }
}

async function main(): Promise<void> {
  console.warn(
    '⚠️  AiFinOps is running WITHOUT inbound authentication — do not expose this port on an untrusted network.',
  );

  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('❌ Could not connect to Postgres. Did you run `npm run setup-db`?');
    console.error(err);
    process.exit(1);
  }

  logProviderReadiness();
  logPricingCoverage();

  const app = Fastify({
    logger: true,
    // A real UUID, not Fastify's default per-process counter (req-1, req-2, ...)
    // — this same ID ties together Fastify's own logs, the audit log file,
    // and the "request_id" column in Postgres for one call.
    genReqId: () => randomUUID(),
  });

  await app.register(chatCompletionsRoute);
  await app.register(healthRoute);
  await app.register(logsRoute);
  await app.register(logsExportRoute);
  await app.register(overviewRoute);

  let vite: ViteDevServer | undefined;

  if (env.NODE_ENV === 'production') {
    const frontendDist = join(process.cwd(), 'frontend/dist');
    if (existsSync(join(frontendDist, 'index.html'))) {
      await app.register(fastifyStatic, { root: frontendDist });
      console.log('✅ Serving the logs dashboard from frontend/dist');
    } else {
      console.log(
        'ℹ️  frontend/dist not found — run `npm run build:frontend` to serve the dashboard from ' +
          'this process.',
      );
    }
  } else {
    // Vite runs in middleware mode inside this same process, so the API and the
    // HMR-enabled dashboard are both served from env.PORT — no second dev server.
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      root: join(process.cwd(), 'frontend'),
      server: { middlewareMode: true, hmr: { server: app.server } },
      appType: 'spa',
    });
    await app.register(fastifyMiddie);
    // Vite's SPA fallback runs in the onRequest phase, ahead of Fastify's own
    // routing — without this guard it would swallow /api, /v1 and /health
    // requests and answer them with index.html before our routes ever saw them.
    const viteServer = vite;
    app.use((req, res, next) => {
      if (req.url?.startsWith('/api') || req.url?.startsWith('/v1') || req.url === '/health') {
        return next();
      }
      viteServer.middlewares(req, res, next);
    });
    console.log('✅ Serving the logs dashboard via Vite (HMR) on this same port');
  }

  // Vite's HMR websocket and Postgres pool both keep the event loop alive, so `tsx watch`
  // can't exit us on a file-change restart unless we close them ourselves — without this,
  // a restart force-kills the process and can leave the whole watcher unable to recover.
  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received, shutting down...`);
    await vite?.close();
    await app.close();
    await pool.end();
    process.exit(0);
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 AiFinOps listening on port ${env.PORT} (${env.NODE_ENV})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
