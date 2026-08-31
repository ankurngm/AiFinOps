/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { getDistinctResolvedModelIds, getLogById, listLogs } from '../db/logsRepository.js';
import { providers } from '../config/providers.js';
import { logIdParamSchema, logsListQuerySchema } from '../schemas/logsQuery.js';

export async function logsRoute(app: FastifyInstance): Promise<void> {
  app.get('/api/logs', async (request, reply) => {
    const parseResult = logsListQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'invalid query parameters',
        details: parseResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const { page, pageSize, ...filters } = parseResult.data;
    const { rows, totalRows } = await listLogs(pool, filters, page, pageSize);

    return reply.send({
      rows,
      pagination: {
        page,
        pageSize,
        totalRows,
        totalPages: totalRows === 0 ? 0 : Math.ceil(totalRows / pageSize),
      },
    });
  });

  app.get('/api/logs/filters', async (_request, reply) => {
    const resolvedModelIds = await getDistinctResolvedModelIds(pool);
    return reply.send({
      providers: Object.keys(providers),
      statuses: ['success', 'error'],
      resolvedModelIds,
    });
  });

  app.get('/api/logs/:id', async (request, reply) => {
    const parseResult = logIdParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'invalid id' });
    }

    const log = await getLogById(pool, parseResult.data.id);
    if (!log) {
      return reply.status(404).send({ error: `log not found: ${parseResult.data.id}` });
    }

    return reply.send(log);
  });
}
