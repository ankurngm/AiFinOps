import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const providerModelMapSchema = z.record(z.string(), z.array(z.string().min(1)));

export type ProviderModelMap = z.infer<typeof providerModelMapSchema>;

const PROVIDER_MODEL_MAP_PATH = join(process.cwd(), 'config', 'providerModelMap.json');

function loadProviderModelMap(): ProviderModelMap {
  let raw: string;
  try {
    raw = readFileSync(PROVIDER_MODEL_MAP_PATH, 'utf-8');
  } catch (err) {
    console.error(`\n❌ Could not read provider model map at ${PROVIDER_MODEL_MAP_PATH}\n`, err);
    process.exit(1);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`\n❌ ${PROVIDER_MODEL_MAP_PATH} is not valid JSON\n`, err);
    process.exit(1);
  }

  const result = providerModelMapSchema.safeParse(json);
  if (!result.success) {
    console.error(`\n❌ Invalid provider model map in ${PROVIDER_MODEL_MAP_PATH}:\n`);
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const providerModelMap: ProviderModelMap = loadProviderModelMap();

export function isModelProvisioned(providerName: string, providerModelId: string): boolean {
  return providerModelMap[providerName]?.includes(providerModelId) ?? false;
}
