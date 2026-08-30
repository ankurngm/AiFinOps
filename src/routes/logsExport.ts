/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { csvEscape, truncateJson } from '../db/csvUtils.js';
import { iterateLogsForExport, type LogDetail } from '../db/logsRepository.js';
import { logsFiltersSchema } from '../schemas/logsQuery.js';

const CSV_COLUMNS = [
  'id',
  'createdAt',
  'provider',
  'requestedModel',
  'resolvedModelId',
  'status',
  'httpStatusCode',
  'errorMessage',
  'promptTokens',
  'completionTokens',
  'totalTokens',
  'cachedTokens',
  'cacheWriteTokens',
  'reasoningTokens',
  'cost',
  'upstreamInferenceCost',
  'latencyMs',
  'regionId',
  'environment',
  'tenantId',
  'applicationId',
  'moduleId',
  'processOrUserId',
  'transactionId',
  'requestId',
  'requestBodyPreview',
  'responseBodyPreview',
] as const;

function toCsvLine(row: LogDetail): string {
  const values: unknown[] = [
    row.id,
    row.createdAt,
    row.provider,
    row.requestedModel,
    row.resolvedModelId,
    row.status,
    row.httpStatusCode,
    row.errorMessage,
    row.promptTokens,
    row.completionTokens,
    row.totalTokens,
    row.cachedTokens,
    row.cacheWriteTokens,
    row.reasoningTokens,
    row.cost,
    row.upstreamInferenceCost,
    row.latencyMs,
    row.regionId,
    row.environment,
    row.tenantId,
    row.applicationId,
    row.moduleId,
    row.processOrUserId,
    row.transactionId,
    row.requestId,
    truncateJson(row.requestBody),
    truncateJson(row.responseBody),
  ];
  return values.map(csvEscape).join(',');
}

function filenameFor(extension: string): string {
  return `aifinops-logs-${Date.now()}.${extension}`;
}

export async function logsExportRoute(app: FastifyInstance): Promise<void> {
  app.get('/api/logs/export.csv', async (request, reply) => {
    const parseResult = logsFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'invalid query parameters' });
    }
    const filters = parseResult.data;

    async function* csvLines(): AsyncGenerator<string> {
      yield CSV_COLUMNS.join(',') + '\r\n';
      for await (const row of iterateLogsForExport(pool, filters)) {
        yield toCsvLine(row) + '\r\n';
      }
    }

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filenameFor('csv')}"`);
    return reply.send(Readable.from(csvLines()));
  });

  app.get('/api/logs/export.jsonl', async (request, reply) => {
    const parseResult = logsFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'invalid query parameters' });
    }
    const filters = parseResult.data;

    async function* jsonlLines(): AsyncGenerator<string> {
      for await (const row of iterateLogsForExport(pool, filters)) {
        yield JSON.stringify(row) + '\n';
      }
    }

    reply.header('Content-Type', 'application/x-ndjson; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filenameFor('jsonl')}"`);
    return reply.send(Readable.from(jsonlLines()));
  });
}
