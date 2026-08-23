/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PGUSER: z.string().min(1, 'PGUSER is required'),
  PGHOST: z.string().min(1, 'PGHOST is required'),
  PGDATABASE: z.string().min(1, 'PGDATABASE is required'),
  PGPASSWORD: z.string().min(1, 'PGPASSWORD is required'),
  PGPORT: z.coerce.number().int().positive('PGPORT must be a positive integer'),

  PORT: z.coerce.number().int().positive('PORT must be a positive integer'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // File-based audit logging is opt-in — off by default. Postgres remains
  // the "must have" record regardless of this setting.
  FILE_LOGGING_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  LOG_DIR: z.string().min(1).optional().default('./logs'),
  LOG_MAX_SIZE: z.string().min(1).optional().default('10m'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('\n❌ Invalid or missing environment variables:\n');
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || '(unknown)';
      console.error(`  - ${field}: ${issue.message}`);
    }
    console.error('\nCheck your .env file against .env.example and try again.\n');
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
