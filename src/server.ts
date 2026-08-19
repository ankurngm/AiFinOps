import Fastify from 'fastify';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { chatCompletionsRoute } from './routes/chatCompletions.js';

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

  const app = Fastify({
    logger: true,
  });

  await app.register(chatCompletionsRoute);

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
