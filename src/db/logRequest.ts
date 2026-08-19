import type { Pool } from 'pg';

export type RequestStatus = 'success' | 'error';

export interface RequestLogEntry {
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
    latency_ms
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
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
    ]);
  } catch (err) {
    console.error('❌ Failed to write request log to database:', err);
  }
}
