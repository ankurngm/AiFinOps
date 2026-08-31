/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

// Calls OpenAI directly (not via OpenRouter) through AiFinOps, tagged with
// all 7 AiFinOps-* attribution headers. Uses Node's built-in fetch — no
// dependencies needed.
//
// Prerequisite: the gateway must already be running (`npm run dev` from the
// repo root), with OPENAI_API_KEY set in .env and "gpt-4o-mini" provisioned
// in config/providerModelMap.json (it is, by default).
//
// Run: node openai-chat-completion-with-attribution.js
// Real cost: yes — a real OpenAI call (fractions of a cent with gpt-4o-mini).

const AIFINOPS_URL = process.env.AIFINOPS_URL ?? 'http://localhost:8787';

async function main() {
  const res = await fetch(`${AIFINOPS_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'AiFinOps-Region-Id': 'us-east-1',
      'AiFinOps-Environment': 'production',
      'AiFinOps-Tenant-Id': 'tenant_enterprise_apple',
      'AiFinOps-Application-Id': 'customer-portal',
      'AiFinOps-Module-Id': 'billing',
      'AiFinOps-Process-Or-User-Id': 'usr_98234',
      'AiFinOps-Transaction-Id': 'tx_abc123xyz789',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
      // temperature is optional and passed straight through to OpenAI
      // unmodified — AiFinOps doesn't validate whether a given model
      // accepts it. It works on gpt-4o-mini (used here) and OpenAI's other
      // standard chat models; OpenAI's reasoning models (o3, o4-mini) are
      // expected to reject a non-default temperature (or top_p) with an
      // error from OpenAI itself.
      temperature: 0.7,
    }),
  });

  const data = await res.json();
  console.log('HTTP status:', res.status);
  console.log(JSON.stringify(data, null, 2));
  console.log(
    '\nCheck the "requests" table in Postgres — this call\'s row should have ' +
      'tenant_id = "tenant_enterprise_apple", application_id = "customer-portal", etc.',
  );
}

main().catch((err) => {
  console.error('Request failed:', err);
  process.exit(1);
});
