/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

// Points the official OpenAI Node SDK at AiFinOps via `baseURL`, calling
// OpenAI directly (not via OpenRouter) — attribution is passed as per-call
// headers, no changes to the request body. Same drop-in compatibility
// using-openai-sdk.js demonstrates for OpenRouter, this time for OpenAI.
//
// UNLIKE the other examples in this folder, this one needs a dependency
// that is NOT installed by this repo's own package.json:
//
//     npm install openai
//
// Run that from inside this examples/nodejs/ directory first, then:
//
// Prerequisite: the gateway must already be running (`npm run dev` from the
// repo root), with OPENAI_API_KEY set in .env and "gpt-4o-mini" provisioned
// in config/providerModelMap.json (it is, by default).
//
// Run: node openai-using-openai-sdk-with-attribution.js
// Real cost: yes — a real OpenAI call (fractions of a cent with gpt-4o-mini).

import OpenAI from 'openai';

const AIFINOPS_URL = process.env.AIFINOPS_URL ?? 'http://localhost:8787/v1';

const client = new OpenAI({
  apiKey: 'unused', // AiFinOps does not check this — the SDK just requires a value
  baseURL: AIFINOPS_URL,
});

async function main() {
  const completion = await client.chat.completions.create(
    {
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
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
