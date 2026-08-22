# 💸 AiFinOps

AiFinOps is a self-hosted, OpenAI-compatible **LLM gateway built for cost governance**. Every
call your team makes to an LLM — provider, model, tokens, cost — passes through one audited
front door, gated by an allow-list you control, before it ever reaches a provider.

Unlike calling a provider SDK directly, nothing goes out that wasn't explicitly approved, no
credential ever leaves the gateway, and every call is written to Postgres before the response
even comes back — so you have a permanent, queryable spend record from day one, not a project
you have to bolt on after the first surprising invoice.

## 📊 Why AiFinOps

Sound familiar?

- "How much are we spending on LLMs this month — and is it growing?"
- "Which team or app is driving that spend?"
- "Could we be paying less for the same task on a different model?"
- "Is anyone calling a model we never approved?"

If your team can't answer these today, you're one invoice away from an uncomfortable
conversation. AiFinOps exists so you can answer them before your VP or CFO asks — with
**preventive** controls, not just after-the-fact reporting:

- **Nothing gets called unless it's explicitly provisioned.** A request for a model that isn't
  on your allow-list is rejected with a `400` before it ever reaches the provider.
- **Provider credentials never leave the gateway.** One audited front door, not a key scattered
  across every service that calls an LLM.
- **Every call is logged, in full, before the response is returned.** Full request/response
  bodies, tokens, and cost — a complete record of what was spent and on what.

Approving a new model is a one-line, explicit decision — add it here and it's callable; leave it
out and it's a `400`, no matter what the provider itself would accept:

```json
"openrouter": ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"]
```

**v1 ships today:** full request-level cost logging for OpenRouter, with optional attribution
tags (tenant, application, module, user, transaction, region, environment) captured on every
call. **Next up:** rolling that up into a usage dashboard — see [Roadmap](#roadmap) below.

→ For exactly how requests are validated, routed, and logged, see
[ARCHITECTURE.md](ARCHITECTURE.md).

## 🚀 Get Started

Prerequisites: Node.js 20+, a running Postgres server, and an OpenRouter API key.

```bash
npm install
cp .env.example .env
# edit .env: fill in your Postgres credentials and OPENROUTER_API_KEY
npm run setup-db
npm run dev
```

> ⚠️ **v1 has no inbound authentication.** Anyone who can reach this port can make LLM calls
> billed to your account. Don't expose it beyond a trusted network until authentication ships —
> see [Roadmap](#roadmap).

Then call it like any OpenAI Chat Completions endpoint, using a gateway-flavored `model` string
(`"<provider>/<providerModelId>"`):

```bash
curl -s http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openrouter/openai/gpt-4o-mini",
    "messages": [{ "role": "user", "content": "Say hello in one sentence." }]
  }'
```

That's it — the response comes back OpenAI-shaped, and the call is already logged to Postgres
with full request/response and cost detail, success or failure.

## 🗺️ Roadmap

Near-term priorities:

- **Additional provider support** — native Anthropic, Gemini, and other transformers, each with
  a maintained pricing table for cost accounting beyond what OpenRouter reports today.
- **Cost attribution to tenant / application / user / transaction** — roll up spend on top of
  today's request-level logging.
- **Spend limits at the model and application level** — configurable soft and hard limits, so
  spend can be capped before it happens.
- **A usage dashboard** — a UI for spend, volume, and trends over time, instead of querying
  Postgres directly.

And further out: streaming responses, inbound gateway authentication, per-tenant/per-team
provisioning scoping, normalized cross-provider error shapes, retry/fallback logic, and an
`extra_body`-style escape hatch for provider-native-only parameters.

→ See [ARCHITECTURE.md](ARCHITECTURE.md) for how the `ProviderTransformer` interface makes most
of this additive, not a rewrite.

## Changelog

All notable changes to this project are documented here. Dates are in `YYYY-MM-DD` format.

### 0.1.1 — 2026-08-19

- Licensed under [Elastic License 2.0](LICENSE), plus a supplemental attribution term — free for
  personal, commercial, and enterprise use and modification, with restrictions on (a) offering
  it as a hosted/managed service to third parties, and (b) redistributing without a visible
  attribution link back to the original repository.
- Added a license header to every source file (`src/`, `scripts/`, `eslint.config.js`).
- Added a `GET /health` endpoint — reports overall status, app version, uptime, Postgres
  reachability (`200`/`503`), and per-provider readiness. Safe to expose without inbound auth;
  reports no secrets or business data.
- Added optional cost-attribution headers (`AiFinOps-Region-Id`, `-Environment`, `-Tenant-Id`,
  `-Application-Id`, `-Module-Id`, `-Process-Or-User-Id`, `-Transaction-Id`) — captured in the
  `requests` table for future dashboard filtering, never forwarded to the LLM provider. See
  [ARCHITECTURE.md](ARCHITECTURE.md#attribution-headers) for the full field reference.
- Added Node.js usage examples under [`examples/nodejs/`](examples/nodejs) — basic call,
  call with attribution, calling an unprovisioned model (shows the compliance gate), and using
  the official `openai` SDK against AiFinOps via `baseURL`.
- Added curl usage examples under [`examples/curl/`](examples/curl) — basic call, call with
  attribution, and calling an unprovisioned model (shows the compliance gate).
- Added optional file-based audit logging (`FILE_LOGGING_ENABLED`, off by default) — one JSON
  line per call (caller request, what was forwarded to the provider, the provider's response,
  and what was sent back to the caller), size-rotated via `LOG_MAX_SIZE` (default `10m`),
  retention deliberately uncapped. Every request now gets a real UUID (`request.id`), shared
  across Fastify's own logs, the audit log file, and a new `request_id` column in Postgres, so
  any of the three can be used to find the others. Postgres logging is unaffected either way.
  See [ARCHITECTURE.md](ARCHITECTURE.md#file-based-audit-logging) for the full design.
- Added Ollama support (`OllamaTransformer`, via Ollama's OpenAI-compatible endpoint) — Supporting local models.
- Added dated, per-token model pricing (`config/modelPricing.json`) for providers that don't
  self-report cost. Provisioning and pricing are independent gates — an approved-but-unpriced
  model still processes normally, with `cost` logged as `NULL`, never blocked. Boot-time,
  non-fatal visibility into pricing gaps via each provider's `requiresPricingCheck` flag. See
  [ARCHITECTURE.md](ARCHITECTURE.md#model-pricing) for the full design.
- Added a `"*"` wildcard fallback in `modelPricing.json` — a provider-level default rate used
  when a model has **no pricing history at all**, so a provider where most models are free
  (Ollama) doesn't need an identical rate repeated for every one of them. A model with its own
  entry never falls back to `"*"`, even if every record under it has expired — an all-expired
  history means someone forgot to add the next record, and that's meant to surface as `NULL`
  (and a boot-time warning), not be silently masked by the wildcard rate.
- `config/modelPricing.json`'s shipped default now uses that wildcard — `ollama: { "*": [{ ...,
"inputPerMillion": 0, "outputPerMillion": 0 }] }` — instead of a model-specific entry, so any
  approved local Ollama model is `$0` by default without needing its own record.
- Documented (and named explicitly in code — `utcDateString()`, not the previous unlabeled
  `isoDate()`) that pricing `startDate`/`endDate` transitions happen at UTC midnight, not the
  server's local time — a real, previously-unstated gap where a date could take effect up to
  half a day off from what an operator typing that date actually intended.

### 0.1.0 — 2026-08-19

Initial release.

- OpenAI-compatible `POST /v1/chat/completions` endpoint.
- OpenRouter provider support via the `ProviderTransformer` interface.
- Provider/model allow-list gate (`config/providers.json`,
  `config/providerModelMap.json`) as a preventive cost-control mechanism.
- Full request/response/cost logging to Postgres (`requests` table), success or failure.
- Zod-validated environment configuration with fail-fast startup checks.
- Postgres connectivity check (`SELECT 1`) before accepting HTTP traffic.

---

For the full technical reference — architecture diagram, request flow, environment variables,
database schema, and how to add a new provider — see **[ARCHITECTURE.md](ARCHITECTURE.md)**.

## License

AiFinOps is licensed under the [Elastic License 2.0](LICENSE), plus one supplemental term. You're
free to use, modify, and redistribute it — including for commercial and enterprise purposes —
with two conditions: you may not offer it, or a modified version of it, to third parties as a
hosted or managed service; and any redistribution must include a visible attribution link back
to [github.com/ankurngm/AiFinOps](https://github.com/ankurngm/AiFinOps).

## Author

Created by [Ankur Nigam](https://www.linkedin.com/in/ankurnigam/).
