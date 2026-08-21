/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import type { Pool } from 'pg';

export type RequestStatus = 'success' | 'error';

export interface RequestLogEntry {
  requestId: string;
  provider: string;
  requestedModel: string;
  resolvedModelId: string;
  requestBody: unknown;
  responseBody: unknown | null;
  status: RequestStatus;
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
}

const INSERT_SQL = `
  INSERT INTO requests (
    provider,
    requested_model,
    resolved_model_id,
    request_body,
    response_body,
    status,
    http_status_code,
    error_message,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    cached_tokens,
    cache_write_tokens,
    reasoning_tokens,
    cost,
    upstream_inference_cost,
    latency_ms,
    region_id,
    environment,
    tenant_id,
    application_id,
    module_id,
    process_or_user_id,
    transaction_id,
    request_id
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
    $18, $19, $20, $21, $22, $23, $24, $25
  )
`;

/**
 * Inserts one row into the requests table. Never throws — a logging
 * failure must not crash the request handler. On failure, the error is
 * printed to server logs so it's at least visible operationally.
 */
export async function logRequest(pool: Pool, entry: RequestLogEntry): Promise<void> {
  try {
    await pool.query(INSERT_SQL, [
      entry.provider,
      entry.requestedModel,
      entry.resolvedModelId,
      JSON.stringify(entry.requestBody),
      entry.responseBody === null ? null : JSON.stringify(entry.responseBody),
      entry.status,
      entry.httpStatusCode,
      entry.errorMessage,
      entry.promptTokens,
      entry.completionTokens,
      entry.totalTokens,
      entry.cachedTokens,
      entry.cacheWriteTokens,
      entry.reasoningTokens,
      entry.cost,
      entry.upstreamInferenceCost,
      entry.latencyMs,
      entry.regionId,
      entry.environment,
      entry.tenantId,
      entry.applicationId,
      entry.moduleId,
      entry.processOrUserId,
      entry.transactionId,
      entry.requestId,
    ]);
  } catch (err) {
    console.error('❌ Failed to write request log to database:', err);
  }
}
