/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

// Minimal example: a single chat completion call through AiFinOps, no
// attribution headers. Uses Node's built-in fetch — no dependencies needed.
//
// Prerequisite: the gateway must already be running (`npm run dev` from the
// repo root), with a provisioned provider (see README's Get Started section).
//
// Run: node basic-chat-completion.js
// Real cost: yes — this reaches OpenRouter (fractions of a cent with gpt-4o-mini).

const AIFINOPS_URL = process.env.AIFINOPS_URL ?? 'http://localhost:8787';

async function main() {
  const res = await fetch(`${AIFINOPS_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openrouter/openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
    }),
  });

  const data = await res.json();
  console.log('HTTP status:', res.status);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error('Request failed:', err);
  process.exit(1);
});
