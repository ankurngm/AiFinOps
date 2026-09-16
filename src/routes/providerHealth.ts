/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import type { FastifyInstance } from 'fastify';
import { providers } from '../config/providers.js';
import { pool } from '../db/pool.js';
import {
  getProviderHealthSnapshot,
  getProviderHealthTrends,
} from '../db/providerHealthRepository.js';
import { providerHealthWindowQuerySchema } from '../schemas/providerHealthQuery.js';

export async function providerHealthRoute(app: FastifyInstance): Promise<void> {
  // Provider-level rollup for the selected window — no tenant/app/model filters apply here.
  app.get('/api/provider-health/snapshot', async (request, reply) => {
    const parseResult = providerHealthWindowQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'invalid query parameters' });
    }

    const { windowDays } = parseResult.data;
    const stats = await getProviderHealthSnapshot(pool, windowDays);
    return reply.send({ windowDays, stats });
  });

  // Same window as the snapshot, broken into buckets to show the trend within it.
  app.get('/api/provider-health/trends', async (request, reply) => {
    const parseResult = providerHealthWindowQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'invalid query parameters' });
    }

    const { windowDays } = parseResult.data;
    const { granularity, buckets } = await getProviderHealthTrends(pool, windowDays);
    return reply.send({ providers: Object.keys(providers), windowDays, granularity, buckets });
  });
}
