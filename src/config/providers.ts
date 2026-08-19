import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const providerConfigSchema = z.object({
  displayName: z.string().min(1),
  baseUrl: z.string().url(),
  // Optional: keyless providers (e.g. a local Ollama endpoint) omit this
  apiKeyEnvVar: z.string().min(1).optional(),
});

const providersSchema = z.record(z.string(), providerConfigSchema);

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type ProvidersMap = z.infer<typeof providersSchema>;

const PROVIDERS_CONFIG_PATH = join(process.cwd(), 'config', 'providers.json');

function loadProviders(): ProvidersMap {
  let raw: string;
  try {
    raw = readFileSync(PROVIDERS_CONFIG_PATH, 'utf-8');
  } catch (err) {
    console.error(`\n❌ Could not read provider config at ${PROVIDERS_CONFIG_PATH}\n`, err);
    process.exit(1);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`\n❌ ${PROVIDERS_CONFIG_PATH} is not valid JSON\n`, err);
    process.exit(1);
  }

  const result = providersSchema.safeParse(json);
  if (!result.success) {
    console.error(`\n❌ Invalid provider config in ${PROVIDERS_CONFIG_PATH}:\n`);
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const providers: ProvidersMap = loadProviders();

export function getProvider(providerName: string): ProviderConfig | undefined {
  return providers[providerName];
}

export interface ProviderReadiness {
  ready: string[];
  notReady: string[];
}

/**
 * Classifies every provider listed in providers.json by whether it's
 * usable: keyless providers (no apiKeyEnvVar, e.g. a local Ollama endpoint)
 * are always ready. Providers.json can list more providers than a given
 * deployment uses — only the ones actually usable are "ready"; the rest are
 * just unused catalog entries, not a boot failure.
 */
export function getProviderReadiness(): ProviderReadiness {
  const ready: string[] = [];
  const notReady: string[] = [];

  for (const [name, config] of Object.entries(providers)) {
    if (!config.apiKeyEnvVar || process.env[config.apiKeyEnvVar]) {
      ready.push(name);
    } else {
      notReady.push(name);
    }
  }

  return { ready, notReady };
}
