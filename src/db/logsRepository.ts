/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import type { Pool } from 'pg';
import type { LogsFilters } from '../schemas/logsQuery.js';
import { buildLogsWhereClause } from './logsFilterBuilder.js';

export interface LogListRow {
  id: string;
  createdAt: string;
  provider: string;
  requestedModel: string;
  resolvedModelId: string;
  status: 'success' | 'error';
  httpStatusCode: number | null;
  errorMessage: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  cost: number | null;
  upstreamInferenceCost: number | null;
  latencyMs: number;
  regionId: string | null;
  environment: string | null;
  tenantId: string | null;
  applicationId: string | null;
  moduleId: string | null;
  processOrUserId: string | null;
  transactionId: string | null;
  requestId: string | null;
}

export interface LogDetail extends LogListRow {
  requestBody: unknown;
  responseBody: unknown;
}

// Raw shape of a `requests` row as returned by `pg`. int8 (BIGSERIAL) and
// uuid columns come back as strings; timestamptz comes back as a Date;
// numeric(12,6) comes back as a string, all to avoid precision loss going
// through the driver's default type parsers.
interface RawLogRow {
  id: string;
  created_at: Date;
  provider: string;
  requested_model: string;
  resolved_model_id: string;
  request_body?: unknown;
  response_body?: unknown;
  status: 'success' | 'error';
  http_status_code: number | null;
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cached_tokens: number | null;
  cache_write_tokens: number | null;
  reasoning_tokens: number | null;
  cost: string | null;
  upstream_inference_cost: string | null;
  latency_ms: number;
  region_id: string | null;
  environment: string | null;
  tenant_id: string | null;
  application_id: string | null;
  module_id: string | null;
  process_or_user_id: string | null;
  transaction_id: string | null;
  request_id: string | null;
}

const LIST_COLUMNS = `
  id, created_at, provider, requested_model, resolved_model_id, status, http_status_code,
  error_message, prompt_tokens, completion_tokens, total_tokens, cached_tokens,
  cache_write_tokens, reasoning_tokens, cost, upstream_inference_cost, latency_ms, region_id,
  environment, tenant_id, application_id, module_id, process_or_user_id, transaction_id,
  request_id
`;

function mapListRow(row: RawLogRow): LogListRow {
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    provider: row.provider,
    requestedModel: row.requested_model,
    resolvedModelId: row.resolved_model_id,
    status: row.status,
    httpStatusCode: row.http_status_code,
    errorMessage: row.error_message,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    cachedTokens: row.cached_tokens,
    cacheWriteTokens: row.cache_write_tokens,
    reasoningTokens: row.reasoning_tokens,
    cost: row.cost === null ? null : Number(row.cost),
    upstreamInferenceCost:
      row.upstream_inference_cost === null ? null : Number(row.upstream_inference_cost),
    latencyMs: row.latency_ms,
    regionId: row.region_id,
    environment: row.environment,
    tenantId: row.tenant_id,
    applicationId: row.application_id,
    moduleId: row.module_id,
    processOrUserId: row.process_or_user_id,
    transactionId: row.transaction_id,
    requestId: row.request_id,
  };
}

function mapDetailRow(row: RawLogRow): LogDetail {
  return {
    ...mapListRow(row),
    requestBody: row.request_body ?? null,
    responseBody: row.response_body ?? null,
  };
}

export interface ListLogsResult {
  rows: LogListRow[];
  totalRows: number;
}

export async function listLogs(
  pool: Pool,
  filters: LogsFilters,
  page: number,
  pageSize: number,
): Promise<ListLogsResult> {
  const { whereSql, params } = buildLogsWhereClause(filters);
  const offset = (page - 1) * pageSize;

  const [rowsResult, countResult] = await Promise.all([
    pool.query<RawLogRow>(
      `SELECT ${LIST_COLUMNS} FROM requests ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM requests ${whereSql}`,
      params,
    ),
  ]);

  return {
    rows: rowsResult.rows.map(mapListRow),
    totalRows: Number(countResult.rows[0]?.count ?? '0'),
  };
}

export async function getLogById(pool: Pool, id: string): Promise<LogDetail | null> {
  const { rows } = await pool.query<RawLogRow>('SELECT * FROM requests WHERE id = $1', [id]);
  return rows[0] ? mapDetailRow(rows[0]) : null;
}

export async function getDistinctResolvedModelIds(pool: Pool, limit = 500): Promise<string[]> {
  const { rows } = await pool.query<{ resolved_model_id: string }>(
    'SELECT DISTINCT resolved_model_id FROM requests ORDER BY resolved_model_id LIMIT $1',
    [limit],
  );
  return rows.map((row) => row.resolved_model_id);
}

const EXPORT_BATCH_SIZE = 500;

/**
 * Streams every row matching `filters` in batches, using keyset pagination
 * (`id > lastId`) rather than OFFSET — an export can walk an unbounded
 * number of rows, and OFFSET cost grows linearly with how far in you are,
 * while keyset stays flat per batch regardless of position.
 */
export async function* iterateLogsForExport(
  pool: Pool,
  filters: LogsFilters,
  batchSize = EXPORT_BATCH_SIZE,
): AsyncGenerator<LogDetail> {
  const { whereSql, params } = buildLogsWhereClause(filters);
  let lastId = '0';

  for (;;) {
    const keysetClause = whereSql
      ? `${whereSql} AND id > $${params.length + 1}`
      : `WHERE id > $${params.length + 1}`;
    const { rows } = await pool.query<RawLogRow>(
      `SELECT * FROM requests ${keysetClause} ORDER BY id ASC LIMIT $${params.length + 2}`,
      [...params, lastId, batchSize],
    );

    if (rows.length === 0) return;
    for (const row of rows) yield mapDetailRow(row);

    const lastRow = rows[rows.length - 1];
    if (!lastRow) return;
    lastId = lastRow.id;
    if (rows.length < batchSize) return;
  }
}
