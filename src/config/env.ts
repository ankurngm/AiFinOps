import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PGUSER: z.string().min(1, 'PGUSER is required'),
  PGHOST: z.string().min(1, 'PGHOST is required'),
  PGDATABASE: z.string().min(1, 'PGDATABASE is required'),
  PGPASSWORD: z.string().min(1, 'PGPASSWORD is required'),
  PGPORT: z.coerce.number().int().positive('PGPORT must be a positive integer'),

  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),

  PORT: z.coerce.number().int().positive('PORT must be a positive integer'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
