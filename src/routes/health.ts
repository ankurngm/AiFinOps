/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { getProviderReadiness } from '../config/providers.js';

const PACKAGE_JSON_PATH = join(process.cwd(), 'package.json');
const appVersion = (JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as { version: string })
  .version;

const startedAt = Date.now();

export async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    let databaseReachable = true;
    try {
      await pool.query('SELECT 1');
    } catch {
      databaseReachable = false;
    }

    const { ready, notReady } = getProviderReadiness();
    const providers: Record<string, 'ready' | 'not_ready'> = {};
    for (const name of ready) providers[name] = 'ready';
    for (const name of notReady) providers[name] = 'not_ready';

    return reply.status(databaseReachable ? 200 : 503).send({
      status: databaseReachable ? 'ok' : 'error',
      version: appVersion,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      database: databaseReachable ? 'reachable' : 'unreachable',
      providers,
    });
  });
}
