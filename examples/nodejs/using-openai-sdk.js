/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

// Points the official OpenAI Node SDK at AiFinOps via `baseURL`, to prove
// AiFinOps is a drop-in-compatible replacement for the real OpenAI Chat
// Completions endpoint — attribution is passed as per-call headers, no
// changes to the request body.
//
// UNLIKE the other examples in this folder, this one needs a dependency
// that is NOT installed by this repo's own package.json:
//
//     npm install openai
//
// Run that from inside this examples/nodejs/ directory first, then:
//
// Run: node using-openai-sdk.js
// Real cost: yes — this reaches OpenRouter (fractions of a cent with gpt-4o-mini).

import OpenAI from 'openai';

const AIFINOPS_URL = process.env.AIFINOPS_URL ?? 'http://localhost:8787/v1';

const client = new OpenAI({
  apiKey: 'unused', // AiFinOps does not check this — the SDK just requires a value
  baseURL: AIFINOPS_URL,
});

async function main() {
  const completion = await client.chat.completions.create(
    {
      model: 'openrouter/openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
    },
    {
      headers: {
        'AiFinOps-Tenant-Id': 'tenant_enterprise_apple',
        'AiFinOps-Application-Id': 'customer-portal',
      },
    },
  );

  console.log(JSON.stringify(completion, null, 2));
}

main().catch((err) => {
  console.error('Request failed:', err);
  process.exit(1);
});
