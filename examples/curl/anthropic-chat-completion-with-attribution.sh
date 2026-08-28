#!/usr/bin/env bash
# Copyright (C) 2026 Ankur Nigam
# Licensed under the Elastic License 2.0, plus a supplemental attribution term.
# See the LICENSE file in the project root for full terms.
# https://github.com/ankurngm/AiFinOps

# Calls Anthropic directly through AiFinOps, tagged with all 7 AiFinOps-*
# attribution headers.
#
# Prerequisite: the gateway must already be running (`npm run dev` from the
# repo root), with ANTHROPIC_API_KEY set in .env and "claude-haiku-4-5-20251001"
# provisioned in config/providerModelMap.json (it is, by default).
#
# Run: ./anthropic-chat-completion-with-attribution.sh
# Real cost: yes — a real Anthropic call (fractions of a cent with Haiku 4.5).
#
# max_tokens is Anthropic-specific: the Messages API requires it on every
# call (OpenAI treats it as optional). AnthropicTransformer falls back to
# 4096 if you omit it — shown explicitly below so this example is
# self-documenting.
#
# temperature is optional and passed straight through to Anthropic
# unmodified — AiFinOps doesn't validate whether a given model accepts it.
# It works on claude-haiku-4-5-20251001 (used here); a handful of newer
# Anthropic models (the Claude 4.7-and-later generation — Fable 5, Opus 5,
# Sonnet 5, Opus 4.8) reject a non-default temperature (or top_p) with an
# error from Anthropic itself. Any other optional Anthropic parameter — e.g.
# top_k — works the same way: forwarded as-is, and whether it's accepted is
# between you and Anthropic, not something this gateway decides.

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
    "model": "anthropic/claude-haiku-4-5-20251001",
    "messages": [{ "role": "user", "content": "Say hello in one sentence." }],
    "max_tokens": 300,
    "temperature": 0.7
  }'
echo ""
echo ""
echo 'Check the "requests" table in Postgres — this call'"'"'s row should have tenant_id = "tenant_enterprise_apple", application_id = "customer-portal", etc.'
