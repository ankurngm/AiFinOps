#!/usr/bin/env bash
# Copyright (C) 2026 Ankur Nigam
# Licensed under the Elastic License 2.0, plus a supplemental attribution term.
# See the LICENSE file in the project root for full terms.
# https://github.com/ankurngm/AiFinOps

# Calls OpenAI directly (not via OpenRouter) through AiFinOps, tagged with
# all 7 AiFinOps-* attribution headers.
#
# Prerequisite: the gateway must already be running (`npm run dev` from the
# repo root), with OPENAI_API_KEY set in .env and "gpt-4o-mini" provisioned
# in config/providerModelMap.json (it is, by default).
#
# Run: ./openai-chat-completion-with-attribution.sh
# Real cost: yes — a real OpenAI call (fractions of a cent with gpt-4o-mini).

set -euo pipefail

AIFINOPS_URL="${AIFINOPS_URL:-http://localhost:8787}"

curl -s -i "$AIFINOPS_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "AiFinOps-Region-Id: us-east-1" \
  -H "AiFinOps-Environment: production" \
  -H "AiFinOps-Tenant-Id: tenant_enterprise_apple" \
  -H "AiFinOps-Application-Id: customer-portal" \
  -H "AiFinOps-Module-Id: billing" \
  -H "AiFinOps-Process-Or-User-Id: usr_98234" \
  -H "AiFinOps-Transaction-Id: tx_abc123xyz789" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{ "role": "user", "content": "Say hello in one sentence." }]
  }'
echo ""
echo ""
echo 'Check the "requests" table in Postgres — this call'"'"'s row should have tenant_id = "tenant_enterprise_apple", application_id = "customer-portal", etc.'
