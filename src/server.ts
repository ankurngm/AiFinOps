/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { env } from './config/env.js';
import { getProviderReadiness } from './config/providers.js';
import { pool } from './db/pool.js';
import { chatCompletionsRoute } from './routes/chatCompletions.js';
import { healthRoute } from './routes/health.js';

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

  const app = Fastify({
    logger: true,
    // A real UUID, not Fastify's default per-process counter (req-1, req-2, ...)
    // — this same ID ties together Fastify's own logs, the audit log file,
    // and the "request_id" column in Postgres for one call.
    genReqId: () => randomUUID(),
  });

  await app.register(chatCompletionsRoute);
  await app.register(healthRoute);

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
