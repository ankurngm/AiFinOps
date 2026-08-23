#!/usr/bin/env bash
# Copyright (C) 2026 Ankur Nigam
# Licensed under the Elastic License 2.0, plus a supplemental attribution term.
# See the LICENSE file in the project root for full terms.
# https://github.com/ankurngm/AiFinOps

# Minimal example: a single chat completion call through AiFinOps, no
# attribution headers.
#
# Prerequisite: the gateway must already be running (`npm run dev` from the
# repo root), with a provisioned provider (see README's Get Started section).
#
# Run: ./basic-chat-completion.sh
# Real cost: yes — this reaches OpenRouter (fractions of a cent with gpt-4o-mini).

set -euo pipefail

AIFINOPS_URL="${AIFINOPS_URL:-http://localhost:8787}"

curl -s -i "$AIFINOPS_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openrouter/openai/gpt-4o-mini",
    "messages": [{ "role": "user", "content": "Say hello in one sentence." }]
  }'
echo ""
