/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

// Calls a model that is NOT in config/providerModelMap.json, to demonstrate
// the compliance/cost-control gate: the request is rejected with a 400
// before it ever reaches OpenRouter. Uses Node's built-in fetch — no
// dependencies needed.
//
// Prerequisite: the gateway must already be running (`npm run dev` from the
// repo root).
//
// Run: node rejected-unprovisioned-model.js
// Real cost: none — this is rejected before reaching the provider.

const AIFINOPS_URL = process.env.AIFINOPS_URL ?? 'http://localhost:8787';

async function main() {
  const res = await fetch(`${AIFINOPS_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openrouter/some-vendor/not-on-the-allow-list',
      messages: [{ role: 'user', content: 'This should never actually run.' }],
    }),
  });

  const data = await res.json();
  console.log('HTTP status:', res.status);
  console.log(JSON.stringify(data, null, 2));
  console.log(
    '\nThis call was rejected before it ever reached OpenRouter — no cost was incurred. ' +
      'To allow it, add "some-vendor/not-on-the-allow-list" to config/providerModelMap.json.',
  );
}

main().catch((err) => {
  console.error('Request failed:', err);
  process.exit(1);
});
