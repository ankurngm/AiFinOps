/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

// Points the official OpenAI Node SDK at AiFinOps via `baseURL`, calling a
// local Ollama model — attribution is passed as per-call headers, no
// changes to the request body. Same drop-in compatibility using-openai-sdk.js
// demonstrates for OpenRouter, this time for Ollama.
//
// UNLIKE the other examples in this folder, this one needs a dependency
// that is NOT installed by this repo's own package.json:
//
//     npm install openai
//
// Run that from inside this examples/nodejs/ directory first, then:
//
// Prerequisite: the gateway must already be running (`npm run dev` from the
// repo root), with Ollama running locally and "llama3.2:3b" pulled
// (`ollama pull llama3.2:3b`) and provisioned in config/providerModelMap.json.
//
// Run: node ollama-using-openai-sdk-with-attribution.js
// Real cost: no — Ollama is local, and config/modelPricing.json's wildcard
// prices it at $0.

import OpenAI from 'openai';

const AIFINOPS_URL = process.env.AIFINOPS_URL ?? 'http://localhost:8787/v1';

const client = new OpenAI({
  apiKey: 'unused', // AiFinOps does not check this — the SDK just requires a value
  baseURL: AIFINOPS_URL,
});

async function main() {
  const completion = await client.chat.completions.create(
    {
      model: 'ollama/llama3.2:3b',
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
