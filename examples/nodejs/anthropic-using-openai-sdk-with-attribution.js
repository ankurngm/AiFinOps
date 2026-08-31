/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

// Points the official OpenAI Node SDK at AiFinOps via `baseURL`, calling
// Anthropic directly — attribution is passed as per-call headers, no changes
// to the request body. Proves the same drop-in compatibility for Anthropic
// that using-openai-sdk.js demonstrates for OpenRouter: AiFinOps translates
// the OpenAI-shaped request/response to and from Anthropic's native Messages
// API, so the caller never has to know the difference.
//
// UNLIKE the other examples in this folder, this one needs a dependency
// that is NOT installed by this repo's own package.json:
//
//     npm install openai
//
// Run that from inside this examples/nodejs/ directory first, then:
//
// Prerequisite: the gateway must already be running (`npm run dev` from the
// repo root), with ANTHROPIC_API_KEY set in .env and "claude-haiku-4-5-20251001"
// provisioned in config/providerModelMap.json (it is, by default).
//
// Run: node anthropic-using-openai-sdk-with-attribution.js
// Real cost: yes — a real Anthropic call (fractions of a cent with Haiku 4.5).

import OpenAI from 'openai';

const AIFINOPS_URL = process.env.AIFINOPS_URL ?? 'http://localhost:8787/v1';

const client = new OpenAI({
  apiKey: 'unused', // AiFinOps does not check this — the SDK just requires a value
  baseURL: AIFINOPS_URL,
});

async function main() {
  const completion = await client.chat.completions.create(
    {
      model: 'anthropic/claude-haiku-4-5-20251001',
      messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
      // max_tokens: optional — deliberately omitted here. Anthropic's own
      // Messages API requires it on every call (unlike OpenAI, where it's
      // optional upstream too), but AiFinOps doesn't make you know that: if
      // none is provided, it defaults to 4096 for Anthropic (DEFAULT_MAX_TOKENS
      // in src/transformers/anthropic.ts), so this call still succeeds. That's
      // this example's whole point — an OpenAI SDK caller shouldn't have to
      // know Anthropic even has this requirement.
      // temperature is optional and passed straight through to Anthropic
      // unmodified — AiFinOps doesn't validate whether a given model
      // accepts it. It works on claude-haiku-4-5-20251001 (used here); a
      // handful of newer Anthropic models (the Claude 4.7-and-later
      // generation — Fable 5, Opus 5, Sonnet 5, Opus 4.8) reject a
      // non-default temperature (or top_p) with an error from Anthropic
      // itself. Any other optional Anthropic parameter — e.g. top_k — works
      // the same way: forwarded as-is, and whether it's accepted is between
      // you and Anthropic, not something this gateway decides.
      temperature: 0.7,
    },
    {
      headers: {
        'AiFinOps-Region-Id': 'us-east-1',
        'AiFinOps-Environment': 'production',
        'AiFinOps-Tenant-Id': 'tenant_enterprise_apple',
        'AiFinOps-Application-Id': 'customer-portal',
        'AiFinOps-Module-Id': 'billing',
        'AiFinOps-Process-Or-User-Id': 'usr_98234',
        'AiFinOps-Transaction-Id': 'tx_abc123xyz789',
      },
    },
  );

  console.log(JSON.stringify(completion, null, 2));
  console.log(
    '\nCheck the "requests" table in Postgres — this call\'s row should have ' +
      'tenant_id = "tenant_enterprise_apple", application_id = "customer-portal", etc.',
  );
}

main().catch((err) => {
  console.error('Request failed:', err);
  process.exit(1);
});
