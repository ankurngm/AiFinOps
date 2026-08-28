/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

// Calls Anthropic directly through AiFinOps, tagged with all 7 AiFinOps-*
// attribution headers. Uses Node's built-in fetch — no dependencies needed.
//
// Prerequisite: the gateway must already be running (`npm run dev` from the
// repo root), with ANTHROPIC_API_KEY set in .env and "claude-haiku-4-5-20251001"
// provisioned in config/providerModelMap.json (it is, by default).
//
// Run: node anthropic-chat-completion-with-attribution.js
// Real cost: yes — a real Anthropic call (fractions of a cent with Haiku 4.5).

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
      model: 'anthropic/claude-haiku-4-5-20251001',
      messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
      // max_tokens: optional. Anthropic's own Messages API requires it on
      // every call (unlike OpenAI, where it's optional upstream too) — but
      // AiFinOps doesn't make you know that: if none is provided, it
      // defaults to 4096 for Anthropic (DEFAULT_MAX_TOKENS in
      // src/transformers/anthropic.ts). Set explicitly here (300) to show
      // overriding that default; the omitted-field case is demonstrated in
      // anthropic-using-openai-sdk-with-attribution.js instead.
      max_tokens: 300,
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
