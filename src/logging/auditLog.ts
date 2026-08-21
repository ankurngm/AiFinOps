/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { mkdirSync } from 'node:fs';
import winston from 'winston';
import { env } from '../config/env.js';

function parseSizeToBytes(size: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*([kmg])?b?$/i.exec(size.trim());
  if (!match) {
    throw new Error(`Invalid LOG_MAX_SIZE: "${size}" (expected e.g. "10m", "500k", "1g")`);
  }
  const value = Number(match[1] ?? '0');
  const unit = (match[2] ?? '').toLowerCase();
  const multiplier = unit === 'g' ? 1024 ** 3 : unit === 'm' ? 1024 ** 2 : unit === 'k' ? 1024 : 1;
  return Math.round(value * multiplier);
}

export interface AttributionFields {
  regionId: string | null;
  environment: string | null;
  tenantId: string | null;
  applicationId: string | null;
  moduleId: string | null;
  processOrUserId: string | null;
  transactionId: string | null;
}

export interface UsageFields {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  cost: number | null;
  upstreamInferenceCost: number | null;
}

export interface AuditLogEntry {
  requestId: string;
  provider: string;
  requestedModel: string;
  resolvedModelId: string;
  status: 'success' | 'error';
  httpStatusCode: number | null;
  errorMessage: string | null;
  latencyMs: number;
  attribution: AttributionFields;
  usage: UsageFields;
  /** What the caller sent us. */
  callerRequest: unknown;
  /** What we actually forwarded upstream (attribution never appears here). */
  providerRequest: unknown;
  /** What the provider sent back. */
  providerResponse: unknown;
  /** What we actually sent back to the caller. */
  callerResponse: unknown;
}

function createLogger(): winston.Logger {
  mkdirSync(env.LOG_DIR, { recursive: true });

  return winston.createLogger({
    format: winston.format.json(),
    transports: [
      new winston.transports.File({
        dirname: env.LOG_DIR,
        filename: 'aifinops-audit.log',
        maxsize: parseSizeToBytes(env.LOG_MAX_SIZE),
        // No maxFiles — retention is deliberately uncapped; rotated files
        // (aifinops-audit1.log, aifinops-audit2.log, ...) are never deleted.
      }),
    ],
  });
}

const logger = env.FILE_LOGGING_ENABLED ? createLogger() : null;

/**
 * Writes one JSON-line audit entry per request — the whole lifecycle
 * (caller request, what was forwarded to the provider, the provider's
 * response, and what was sent back to the caller) as a single record,
 * tagged with the same request ID used in Postgres and in Fastify's own
 * logs. A no-op when FILE_LOGGING_ENABLED is false. Never throws — a
 * logging failure must not crash the request handler.
 */
export function logAudit(entry: AuditLogEntry): void {
  if (!logger) {
    return;
  }
  try {
    logger.info(entry);
  } catch (err) {
    console.error('❌ Failed to write audit log entry to file:', err);
  }
}
