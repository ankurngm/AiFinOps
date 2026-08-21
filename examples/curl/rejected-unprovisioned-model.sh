#!/usr/bin/env bash
# Copyright (C) 2026 Ankur Nigam
# Licensed under the Elastic License 2.0, plus a supplemental attribution term.
# See the LICENSE file in the project root for full terms.
# https://github.com/ankurngm/AiFinOps

# Calls a model that is NOT in config/providerModelMap.json, to demonstrate
# the compliance/cost-control gate: the request is rejected with a 400
# before it ever reaches OpenRouter.
#
# Prerequisite: the gateway must already be running (`npm run dev` from the
# repo root).
#
# Run: ./rejected-unprovisioned-model.sh
# Real cost: none — this is rejected before reaching the provider.

set -euo pipefail

AIFINOPS_URL="${AIFINOPS_URL:-http://localhost:8787}"

curl -s -i "$AIFINOPS_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openrouter/some-vendor/not-on-the-allow-list",
    "messages": [{ "role": "user", "content": "This should never actually run." }]
  }'
echo ""
echo ""
echo "This call was rejected before it ever reached OpenRouter — no cost was incurred."
echo 'To allow it, add "some-vendor/not-on-the-allow-list" to config/providerModelMap.json.'
