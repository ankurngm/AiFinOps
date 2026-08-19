import { Client } from 'pg';
import { env } from '../src/config/env.js';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS requests (
    id                    BIGSERIAL PRIMARY KEY,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    provider              TEXT NOT NULL,
    requested_model       TEXT NOT NULL,
    resolved_model_id     TEXT NOT NULL,
    request_body          JSONB NOT NULL,
    response_body         JSONB,
    status                TEXT NOT NULL,
    http_status_code      INTEGER,
    error_message         TEXT,
    prompt_tokens         INTEGER,
    completion_tokens     INTEGER,
    total_tokens          INTEGER,
    cached_tokens         INTEGER,
    cache_write_tokens    INTEGER,
    reasoning_tokens      INTEGER,
    cost                  NUMERIC(12, 6),
    upstream_inference_cost NUMERIC(12, 6),
    latency_ms            INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at);
  CREATE INDEX IF NOT EXISTS idx_requests_provider_model ON requests (provider, resolved_model_id);
`;

async function main(): Promise<void> {
  const maintenanceClient = new Client({
    host: env.PGHOST,
    port: env.PGPORT,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: 'postgres',
  });

  await maintenanceClient.connect();

  const existsResult = await maintenanceClient.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [env.PGDATABASE],
  );

  if (existsResult.rowCount === 0) {
    console.log(`Creating database "${env.PGDATABASE}"...`);
    // Database names cannot be parameterized in Postgres; PGDATABASE comes
    // from local, trusted env config, not from any external input.
    await maintenanceClient.query(`CREATE DATABASE "${env.PGDATABASE}"`);
  } else {
    console.log(`Database "${env.PGDATABASE}" already exists.`);
  }

  await maintenanceClient.end();

  const targetClient = new Client({
    host: env.PGHOST,
    port: env.PGPORT,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
  });

  await targetClient.connect();
  console.log('Creating table "requests" (if not present)...');
  await targetClient.query(CREATE_TABLE_SQL);
  await targetClient.end();

  console.log('✅ Database setup complete.');
}

main().catch((err: unknown) => {
  console.error('❌ Database setup failed:', err);
  process.exit(1);
});
