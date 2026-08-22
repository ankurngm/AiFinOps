/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { providers } from './providers.js';
import { providerModelMap } from './providerModelMap.js';

// Dates are plain "YYYY-MM-DD" strings, compared lexicographically (which
// matches chronological order for this format). A record is effective for
// the half-open range [startDate, endDate) — endDate is the first day the
// record NO LONGER applies, so the next record's startDate should equal the
// previous record's endDate, with no gap or overlap.
const pricingRecordSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be "YYYY-MM-DD"'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be "YYYY-MM-DD"')
    .nullable(),
  inputPerMillion: z.number().nonnegative(),
  outputPerMillion: z.number().nonnegative(),
  cachedInputPerMillion: z.number().nonnegative().nullable(),
  cacheWritePerMillion: z.number().nonnegative().nullable(),
});

const modelPricingSchema = z.record(z.string(), z.record(z.string(), z.array(pricingRecordSchema)));

export type PricingRecord = z.infer<typeof pricingRecordSchema>;
export type ModelPricing = z.infer<typeof modelPricingSchema>;

const MODEL_PRICING_PATH = join(process.cwd(), 'config', 'modelPricing.json');

function loadModelPricing(): ModelPricing {
  let raw: string;
  try {
    raw = readFileSync(MODEL_PRICING_PATH, 'utf-8');
  } catch (err) {
    console.error(`\n❌ Could not read model pricing config at ${MODEL_PRICING_PATH}\n`, err);
    process.exit(1);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`\n❌ ${MODEL_PRICING_PATH} is not valid JSON\n`, err);
    process.exit(1);
  }

  const result = modelPricingSchema.safeParse(json);
  if (!result.success) {
    console.error(`\n❌ Invalid model pricing config in ${MODEL_PRICING_PATH}:\n`);
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const modelPricing: ModelPricing = loadModelPricing();

// Deliberately UTC, not the server's local timezone: pricing dates need one
// unambiguous clock, not one that silently shifts with wherever the process
// happens to be deployed (two instances in different timezones would
// otherwise disagree about which record is "current"). The real
// consequence: a record's startDate/endDate takes effect at UTC midnight,
// not local midnight — e.g. "startDate": "2026-08-22" starts at 5pm on the
// 21st for someone in US Pacific time, not midnight their own clock. Set
// pricing dates with that in mind.
function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function findEffectiveRecord(
  records: PricingRecord[] | undefined,
  today: string,
): PricingRecord | undefined {
  if (!records) {
    return undefined;
  }

  return records.find((record) => {
    if (record.startDate > today) {
      return false;
    }
    if (record.endDate !== null && record.endDate <= today) {
      return false;
    }
    return true;
  });
}

/**
 * Finds the currently-effective pricing record for (provider, model) — the
 * one whose [startDate, endDate) range covers `asOf` (defaults to now, and
 * is always compared as a UTC calendar day — see utcDateString() above).
 * Expired or not-yet-effective records are ignored; only the live one is
 * ever used to compute a fresh cost. Old records stay in the file for
 * history, they're just never selected here.
 *
 * Falls back to a provider-level "*" entry (exact model match, case-
 * sensitive, same as everywhere else) — but only when the model has **no
 * pricing history at all** (no key for it under this provider). This is
 * what lets a provider like Ollama, where most models are free, declare
 * that once instead of repeating an identical $0 record for every model.
 *
 * A model that DOES have its own entry never falls back to "*", even if
 * every one of its records has expired — a model with recorded history was
 * deliberately priced at some point, so an all-expired history means
 * someone forgot to add the next record, not "treat this like an
 * unconfigured model." That's a real gap worth surfacing as NULL (and the
 * boot-time coverage check will flag it), not silently masking it with a
 * possibly-wrong wildcard rate. A specific model's own currently-valid
 * entry always takes priority over "*" when both would otherwise apply.
 */
export function getCurrentPricing(
  provider: string,
  model: string,
  asOf: Date = new Date(),
): PricingRecord | undefined {
  const today = utcDateString(asOf);
  const providerPricing = modelPricing[provider];
  const modelRecords = providerPricing?.[model];

  if (modelRecords !== undefined) {
    return findEffectiveRecord(modelRecords, today);
  }

  return findEffectiveRecord(providerPricing?.['*'], today);
}

export interface UsageForCost {
  promptTokens: number | null;
  completionTokens: number | null;
  cachedTokens: number | null;
  cacheWriteTokens: number | null;
}

/**
 * Computes cost from a pricing record and token usage. cachedTokens is
 * treated as a subset of promptTokens (tokens served from cache, discounted
 * to cachedInputPerMillion — or the normal input rate if no cache rate is
 * given, so an unpriced cache discount never silently undercounts cost).
 * cacheWriteTokens is treated as a separate, additional operation, priced
 * only if cacheWritePerMillion is given. These are reasonable defaults for
 * the providers in use today; a future provider with different cache
 * semantics may need this revisited.
 */
export function computeCost(record: PricingRecord, usage: UsageForCost): number {
  const promptTokens = usage.promptTokens ?? 0;
  const completionTokens = usage.completionTokens ?? 0;
  const cachedTokens = usage.cachedTokens ?? 0;
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0;

  const uncachedPromptTokens = Math.max(promptTokens - cachedTokens, 0);
  const cachedRate = record.cachedInputPerMillion ?? record.inputPerMillion;

  const inputCost = (uncachedPromptTokens / 1_000_000) * record.inputPerMillion;
  const cachedInputCost = (cachedTokens / 1_000_000) * cachedRate;
  const outputCost = (completionTokens / 1_000_000) * record.outputPerMillion;
  const cacheWriteCost =
    record.cacheWritePerMillion !== null
      ? (cacheWriteTokens / 1_000_000) * record.cacheWritePerMillion
      : 0;

  return inputCost + cachedInputCost + outputCost + cacheWriteCost;
}

export interface PricingCoverageResult {
  /** Providers with requiresPricingCheck explicitly false — enforcement is off. */
  checksSkipped: string[];
  /** "provider/model" pairs that need pricing but have no currently-valid entry. */
  missing: string[];
}

/**
 * Boot-time check: for every provider whose requiresPricingCheck resolves
 * to true (explicit true, or the field is entirely absent — fail toward
 * warning), walk its approved models and flag any without a currently-valid
 * pricing record. Never fatal — this is visibility, not a gate; calls to an
 * unpriced-but-approved model still process normally, with cost left null.
 */
export function checkPricingCoverage(): PricingCoverageResult {
  const checksSkipped: string[] = [];
  const missing: string[] = [];

  for (const [providerName, config] of Object.entries(providers)) {
    if (config.requiresPricingCheck === false) {
      checksSkipped.push(providerName);
      continue;
    }

    const models = providerModelMap[providerName] ?? [];
    for (const model of models) {
      if (!getCurrentPricing(providerName, model)) {
        missing.push(`${providerName}/${model}`);
      }
    }
  }

  return { checksSkipped, missing };
}
