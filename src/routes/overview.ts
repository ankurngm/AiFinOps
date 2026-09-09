/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { getOverviewDetails, getOverviewSummary } from '../db/overviewRepository.js';
import { logsFiltersSchema } from '../schemas/logsQuery.js';

export async function overviewRoute(app: FastifyInstance): Promise<void> {
  // Fixed 30-day snapshot — no query params, always the same window regardless of the
  // filter the Details tab or Logs table has set.
  app.get('/api/overview/summary', async (_request, reply) => {
    const summary = await getOverviewSummary(pool);
    return reply.send(summary);
  });

  // Scoped to the same filters as /api/logs — the Details tab shares filter state with Logs.
  app.get('/api/overview/details', async (request, reply) => {
    const parseResult = logsFiltersSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'invalid query parameters' });
    }

    const details = await getOverviewDetails(pool, parseResult.data);
    return reply.send(details);
  });
}
