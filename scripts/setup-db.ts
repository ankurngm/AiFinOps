/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

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
    latency_ms            INTEGER NOT NULL,
    region_id             TEXT,
    environment           TEXT,
    tenant_id             TEXT,
    application_id        TEXT,
    module_id             TEXT,
    process_or_user_id    TEXT,
    transaction_id        TEXT,
    request_id             UUID          -- shared correlation ID with the audit log file
  );

  -- Idempotent migration for databases created before attribution columns existed.
  ALTER TABLE requests ADD COLUMN IF NOT EXISTS region_id TEXT;
  ALTER TABLE requests ADD COLUMN IF NOT EXISTS environment TEXT;
  ALTER TABLE requests ADD COLUMN IF NOT EXISTS tenant_id TEXT;
  ALTER TABLE requests ADD COLUMN IF NOT EXISTS application_id TEXT;
  ALTER TABLE requests ADD COLUMN IF NOT EXISTS module_id TEXT;
  ALTER TABLE requests ADD COLUMN IF NOT EXISTS process_or_user_id TEXT;
  ALTER TABLE requests ADD COLUMN IF NOT EXISTS transaction_id TEXT;
  ALTER TABLE requests ADD COLUMN IF NOT EXISTS request_id UUID;

  CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at);
  CREATE INDEX IF NOT EXISTS idx_requests_provider_model ON requests (provider, resolved_model_id);
  CREATE INDEX IF NOT EXISTS idx_requests_tenant_id ON requests (tenant_id);
  CREATE INDEX IF NOT EXISTS idx_requests_application_id ON requests (application_id);
  CREATE INDEX IF NOT EXISTS idx_requests_tenant_app ON requests (tenant_id, application_id);
  CREATE INDEX IF NOT EXISTS idx_requests_transaction_id ON requests (transaction_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_request_id ON requests (request_id);

  -- Support the logs dashboard's status/model filters and dropdown queries.
  CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);
  CREATE INDEX IF NOT EXISTS idx_requests_resolved_model_id ON requests (resolved_model_id);
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
