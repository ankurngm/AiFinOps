# AiFinOps — Architecture & Technical Reference

This document covers how AiFinOps processes a request internally, its full configuration
surface, the database schema, and how to extend it with a new provider. For the pitch,
quickstart, and roadmap, see the [README](README.md).

## Request flow

A caller sends a standard OpenAI-shaped request to `POST /v1/chat/completions` with a
gateway-flavored model string (`"<provider>/<providerModelId>"`, e.g.
`"openrouter/openai/gpt-4o"`).

```mermaid
flowchart LR
    Caller -->|"POST /v1/chat/completions\n(OpenAI-shaped body)"| Gateway

    subgraph Gateway["AiFinOps Gateway"]
        Validate["Zod validation\n+ provider/model allow-list\n(preventive cost gate)"]
        Transformer["ProviderTransformer\n(OpenRouter today)"]
        Log["Log request/response/cost"]
        Validate --> Transformer
        Transformer --> Log
    end

    Gateway -->|"resolved model id\n+ provider API key"| Provider["Provider API\n(OpenRouter)"]
    Provider -->|OpenAI-shaped response| Gateway
    Log -->|insert row| DB[(Postgres: requests)]
    Gateway -->|OpenAI-shaped response| Caller
```

The handler in `src/routes/chatCompletions.ts` runs, in this exact order:

1. Validate the optional attribution headers (`AiFinOps-*`, see [Attribution
   headers](#attribution-headers) below) against a Zod schema. An oversized value is rejected
   with a `400` before anything else runs. Valid values are parsed once and carried through
   every log entry written for this request, on every path below.
2. Validate the request body against a Zod schema modeling OpenAI's Chat Completions request
   shape. If `stream: true` is present, reject immediately with a `400` — streaming isn't
   supported yet, and it's never silently ignored or faked.
3. Split `model` on the **first** `/`. Everything before it is the `provider`; everything after
   it is the `providerModelId`, which may itself contain more slashes (e.g. `openai/gpt-4o`).
4. Look up `provider` in `config/providers.json`. If missing, `400 {"error": "provider not
provisioned: <provider>"}`.
5. Look up `providerModelId` in `config/providerModelMap.json[provider]`. If missing, `400
{"error": "model not provisioned for provider <provider>: <providerModelId>"}`.
6. Resolve a `ProviderTransformer` for `provider` via `src/transformers/registry.ts`.
7. The transformer builds the outbound request — for OpenRouter, that's `POST
{baseUrl}/chat/completions` with the caller's body, `model` swapped for the resolved
   `providerModelId`, and (if the provider declares one) `Authorization: Bearer` attached from
   the gateway's own environment. If building the request fails (e.g. a missing API key), that's
   caught, logged to Postgres as a `status: 'error'` row, and returned as a `500` — never an
   unhandled crash. The transformer only ever receives the parsed body — never the attribution
   headers — so attribution data cannot reach the provider even by accident.
8. Send the request, capture wall-clock latency.
9. On success, `parseResponse` validates the response shape and explicitly extracts the `usage`
   object for logging, rather than re-serializing the upstream body blindly.
10. **Before responding to the caller**, insert one row into the `requests` table — full request,
    full response (or error), every usage/cost field available, and the attribution values from
    step 1.
11. Return the (still OpenAI-shaped) response to the caller with the original upstream status
    code.
12. On any failure (network error, non-2xx upstream, invalid response shape), a row is still
    logged with `status = 'error'` and the error message. A logging failure itself never crashes
    the request handler — it's caught and printed to server logs so it's at least visible
    operationally.

## Repository structure

```
src/
  server.ts                  Fastify app bootstrap, fail-fast checks, provider readiness log
  config/
    env.ts                   Zod schema for process.env — infra vars only (PG*, PORT, NODE_ENV)
    providers.ts              Loads/validates config/providers.json, provider readiness check
    providerModelMap.ts       Loads/validates config/providerModelMap.json
    modelPricing.ts            Loads/validates config/modelPricing.json, cost lookup + math
  routes/
    chatCompletions.ts        POST /v1/chat/completions handler
    health.ts                  GET /health handler
  transformers/
    types.ts                  ProviderTransformer interface
    openrouter.ts              OpenRouterTransformer implementation
    ollama.ts                   OllamaTransformer implementation
    registry.ts                   provider name -> transformer instance lookup
  db/
    pool.ts                    pg Pool, built from PG* env vars
    logRequest.ts               insert one row per request/response
  logging/
    auditLog.ts                 optional file-based audit log (Winston, size-rotated)
  schemas/
    chatCompletionRequest.ts    Zod schema for the inbound OpenAI-shaped body
    attribution.ts               Zod schema for the optional attribution headers
config/
  providers.json                which providers are provisioned
  providerModelMap.json         which model IDs are provisioned per provider
  modelPricing.json             dated per-token pricing, for providers that don't self-report cost
scripts/
  setup-db.ts                   creates the DB (if missing) + tables — `npm run setup-db`
```

## Environment variables

| Variable               | Required at boot?               | Purpose                                                                                       |
| ---------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| `PGUSER`               | Yes                             | Postgres username                                                                             |
| `PGHOST`               | Yes                             | Postgres host                                                                                 |
| `PGDATABASE`           | Yes                             | Postgres database name                                                                        |
| `PGPASSWORD`           | Yes                             | Postgres password                                                                             |
| `PGPORT`               | Yes                             | Postgres port (default `5432`)                                                                |
| `PORT`                 | Yes                             | Gateway HTTP port (default `8787`)                                                            |
| `NODE_ENV`             | Yes (defaults to `development`) | `development` \| `production` \| `test`                                                       |
| `OPENROUTER_API_KEY`   | No — checked per-provider       | OpenRouter API key. Only needed if you actually call the `openrouter` provider                |
| `FILE_LOGGING_ENABLED` | No (defaults to `false`)        | Turns on the file-based audit log — see [File-based audit logging](#file-based-audit-logging) |
| `LOG_DIR`              | No (defaults to `./logs`)       | Directory the audit log file is written to (only used if enabled)                             |
| `LOG_MAX_SIZE`         | No (defaults to `10m`)          | Rotation threshold, e.g. `10m`, `500k`, `1g` (only used if enabled)                           |

`PGUSER`/`PGHOST`/`PGDATABASE`/`PGPASSWORD`/`PGPORT`/`PORT`/`NODE_ENV` are validated with Zod
once at startup (`src/config/env.ts`). If any are missing or invalid, the process prints exactly
which ones and exits non-zero — it never starts in a partially-configured state. The gateway
also runs a `SELECT 1` against Postgres before accepting any HTTP traffic and exits if the
database isn't reachable.

**Provider credentials are handled differently, on purpose.** `config/providers.json` can list
more providers than a given deployment actually uses, so a specific provider's key (like
`OPENROUTER_API_KEY`) is deliberately _not_ part of the fixed env schema above — requiring every
provider's key just to boot would break a deployment that only uses one of them. Instead:

- At startup, the gateway checks each entry in `providers.json` against `process.env` and logs
  which providers are actually usable (`✅ Providers ready: openrouter`). If a provider is listed
  but its key is missing, that's a non-fatal warning, not a boot failure. If _no_ provider is
  ready at all, a single warning is printed.
- At request time, the first call to a provider whose key is missing fails cleanly — caught,
  logged to the `requests` table as `status: 'error'`, and returned as a `500`.
- A provider can also be defined **without** `apiKeyEnvVar` at all (e.g. a local Ollama
  endpoint) — in that case no key is checked, ever, at boot or at request time.

## Provider & model provisioning

Two hand-edited JSON files gate what the gateway will actually call. This is a deliberate
compliance/cost-control mechanism, not just routing convenience — a model not listed here is
rejected with a `400` even if the upstream provider would happily serve it.

**`config/providers.json`** — which providers are provisioned at all:

```json
{
  "openrouter": {
    "displayName": "OpenRouter",
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKeyEnvVar": "OPENROUTER_API_KEY",
    "requiresPricingCheck": false
  },
  "ollama": {
    "displayName": "Ollama",
    "baseUrl": "http://localhost:11434/v1",
    "requiresPricingCheck": false
  }
}
```

`apiKeyEnvVar` is optional — omit it for a keyless/local provider and no `Authorization` header
is ever attached for it. `requiresPricingCheck` controls the boot-time pricing check described
in [Model pricing](#model-pricing) below — set explicitly to `false` for a provider that
self-reports cost (OpenRouter) or is a known-free default (Ollama's local models); omit it
entirely to fail toward "check and warn."

**`config/providerModelMap.json`** — which model IDs are allowed per provider, using each
provider's own native model naming (for OpenRouter, its `vendor/model` IDs; for Ollama, its own
model tags, with Ollama Cloud models carrying a `:cloud` suffix, e.g. `"gpt-oss:120b-cloud"`):

```json
{
  "openrouter": ["openai/gpt-4o", "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
  "ollama": ["llama3.2:3b"]
}
```

To allow a new OpenRouter model, add its OpenRouter model ID to the `"openrouter"` array and
restart the gateway:

```json
{
  "openrouter": [
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "mistralai/mistral-large"
  ]
}
```

Callers then address it as `"openrouter/mistralai/mistral-large"` in their request's `model`
field (the gateway splits on the _first_ `/`; everything after it — including any further
slashes — is passed through as-is to the provider).

## Model pricing

Some providers report cost directly in their response (OpenRouter). Others — Ollama, whether
local or a `:cloud`-suffixed model — only report token counts, never a price. For those,
`config/modelPricing.json` supplies per-token rates, keyed by `(provider, model)`:

```json
{
  "ollama": {
    "llama3.2:3b": [
      {
        "startDate": "2026-06-15",
        "endDate": null,
        "inputPerMillion": 0,
        "outputPerMillion": 0,
        "cachedInputPerMillion": null,
        "cacheWritePerMillion": null
      }
    ]
  }
}
```

**Dated, not a flat rate.** Each entry is a list of records with a `[startDate, endDate)` window
(`endDate` is the first day the record no longer applies — exclusive, not inclusive). **`endDate:
null` means the record has no known end and is treated as currently in effect** — this is the
normal state for whatever price is active right now; only the newest record for a model should
have it. Only the one record whose window covers _today_ is ever used to compute a fresh cost;
older records stay in the file for history but are never selected again. When a price changes:
set `endDate` on the old record, append a new one with `startDate` equal to that `endDate` and
`endDate: null`.

**If more than one record is valid for the same date** (a data-entry mistake — windows should
never overlap), `getCurrentPricing()` returns the **first matching record in array order**, not
the newest or the cheapest. This is a plain `Array.find()`, not a conflict-resolution rule — the
file's array order is the tiebreaker, so overlapping windows should be treated as a bug in the
data to fix, not a mechanism to rely on.

**Being unpriced never blocks a call.** Provisioning (`providerModelMap.json`) and pricing
(`modelPricing.json`) are deliberately independent gates. A model can be fully approved and
callable with zero pricing data — the call still processes normally, and `cost` is simply logged
as `NULL` (both in Postgres and the audit log), meaning "not specified," not `0`, which means
"confirmed free."

**Where the cost math runs.** Transformers never compute cost themselves — `OllamaTransformer`
always reports `cost: null`, same as any future provider without native pricing. A single
enrichment step in `src/routes/chatCompletions.ts`, right after a successful `parseResponse`,
fills in `cost` from `modelPricing.json` only when the transformer didn't supply one. This keeps
transformers mechanical (translate request/response shapes) and the one cross-cutting concern
(pricing) in one place. **The enrichment only affects what's logged** — the response body
returned to the caller is never mutated; Ollama's real response has no cost field and stays that
way.

`cachedInputPerMillion`/`cacheWritePerMillion` are optional per record. Cached tokens are
treated as a discounted subset of prompt tokens (falling back to the normal input rate if no
cache rate is given, so an unpriced discount never silently undercounts cost); cache-write
tokens are treated as a separate, additional operation, priced only if a rate is given. See
`computeCost()` in `src/config/modelPricing.ts` for the exact math.

**Boot-time visibility, not enforcement.** For every provider whose `requiresPricingCheck`
resolves to `true` (explicit `true`, or the field is entirely absent), the gateway walks its
approved models and warns (non-fatal) about any without a currently-valid pricing record. For a
provider with `requiresPricingCheck: false`, a different, non-fatal reminder prints instead —
pricing enforcement is off for that provider, so if some of its models are actually billed (e.g.
Ollama Cloud, added later, sharing the `ollama` provider entry with free local models), that
needs a deliberate flip to `true` plus pricing entries for the billed models specifically.

## Database schema

`scripts/setup-db.ts` (run via `npm run setup-db`):

1. Connects to the default `postgres` maintenance database using the `PG*` env vars (overriding
   `PGDATABASE` to `postgres` for this one connection).
2. Checks `pg_database` for an existing database named from `PGDATABASE`; creates it with
   `CREATE DATABASE` only if it doesn't already exist (Postgres has no `CREATE DATABASE IF NOT
EXISTS`).
3. Reconnects to the now-existing target database and creates the `requests` table and its
   indexes if they don't exist:

```sql
CREATE TABLE IF NOT EXISTS requests (
  id                    BIGSERIAL PRIMARY KEY,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider              TEXT NOT NULL,
  requested_model       TEXT NOT NULL,      -- raw "provider/model" string the caller sent
  resolved_model_id     TEXT NOT NULL,      -- what was actually sent upstream, e.g. "openai/gpt-4o"
  request_body          JSONB NOT NULL,     -- exact payload sent to the provider
  response_body         JSONB,              -- exact payload received back (null on hard failure)
  status                TEXT NOT NULL,      -- 'success' | 'error'
  http_status_code      INTEGER,
  error_message         TEXT,
  prompt_tokens         INTEGER,
  completion_tokens     INTEGER,
  total_tokens          INTEGER,
  cached_tokens         INTEGER,
  cache_write_tokens    INTEGER,
  reasoning_tokens      INTEGER,
  cost                  NUMERIC(12, 6),     -- provider-reported, or filled from modelPricing.json; NULL if neither
  upstream_inference_cost NUMERIC(12, 6),   -- from usage.cost_details.upstream_inference_cost (OpenRouter only)
  latency_ms            INTEGER NOT NULL,
  region_id             TEXT,               -- optional attribution, see below
  environment           TEXT,
  tenant_id             TEXT,
  application_id        TEXT,
  module_id             TEXT,
  process_or_user_id    TEXT,
  transaction_id        TEXT,
  request_id             UUID          -- shared correlation ID with the audit log file
);

CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at);
CREATE INDEX IF NOT EXISTS idx_requests_provider_model ON requests (provider, resolved_model_id);
CREATE INDEX IF NOT EXISTS idx_requests_tenant_id ON requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_requests_application_id ON requests (application_id);
CREATE INDEX IF NOT EXISTS idx_requests_tenant_app ON requests (tenant_id, application_id);
CREATE INDEX IF NOT EXISTS idx_requests_transaction_id ON requests (transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_request_id ON requests (request_id);
```

`npm run setup-db` is idempotent and safe to re-run against an existing database — it also issues
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for each attribution column, so upgrading an
already-running deployment just means running it again.

`src/db/logRequest.ts` accepts a typed object covering every column above and performs the
insert — called from the route handler on both the success and every failure path. It never
throws; a logging failure is caught and printed to server logs instead of crashing the request.

Example query — total cost by model over the last 24 hours:

```sql
SELECT resolved_model_id, COUNT(*) AS calls, SUM(cost) AS total_cost
FROM requests
WHERE created_at > now() - interval '24 hours'
GROUP BY resolved_model_id
ORDER BY total_cost DESC;
```

## Attribution headers

Optional cost-attribution metadata a caller can send alongside a request. Captured in the
`requests` table for later filtering/dashboarding; **never forwarded to the LLM provider.**

| Header                        | DB column            | Description                                 | Example                                                  |
| ----------------------------- | -------------------- | ------------------------------------------- | -------------------------------------------------------- |
| `AiFinOps-Region-Id`          | `region_id`          | Geographic or cloud infrastructure zone     | `us-east-1`, `eu-west-2`, `local`                        |
| `AiFinOps-Environment`        | `environment`        | Deployment stage                            | `production`, `staging`, `development`                   |
| `AiFinOps-Tenant-Id`          | `tenant_id`          | Client or organization account              | `tenant_enterprise_apple`, `tenant_free_user_12`         |
| `AiFinOps-Application-Id`     | `application_id`     | Macro-level software application or service | `e-commerce-api`, `customer-portal`, `analytics-worker`  |
| `AiFinOps-Module-Id`          | `module_id`          | Sub-system or component within the app      | `auth-engine`, `payment-gateway`, `billing`, `inventory` |
| `AiFinOps-Process-Or-User-Id` | `process_or_user_id` | System process ID or the active user ID     | `usr_98234` or `pid_4412`                                |
| `AiFinOps-Transaction-Id`     | `transaction_id`     | Unique trace ID for one request workflow    | `tx_abc123xyz789`                                        |

All optional, all free-form strings capped at 255 characters (`src/schemas/attribution.ts`); an
oversized value is rejected with a `400` before anything else runs — no fixed vocabulary is
enforced, values are entirely caller-defined.

Conceptually, these nest (documentation only — not enforced via foreign keys or a hierarchy
table in the schema):

```
[Level 1: Global Scope]      Infrastructure (RegionId)
                                     │
[Level 2: Stage Scope]       Environment
                                     │
[Level 3: Client Scope]      Tenant / Organization (TenantId)
                                     │
[Level 4: System Scope]      Application (ApplicationId)
                                     │
[Level 5: Component Scope]   Sub-System (ModuleId)
                                     │
[Level 6: Context Scope]     Actor / Executor (ProcessOrUserId)
                                     │
[Level 7: Runtime Scope]     Execution Path (TransactionId)
```

**Why headers, not a body field:** `transformer.buildRequest()` only ever receives the parsed
OpenAI-shaped body, never `request.headers` — so attribution data cannot reach the provider by
construction, not because of a "strip this field before forwarding" step that a future refactor
could accidentally break.

**Indexing:** `tenant_id`, `application_id`, their combination, and `transaction_id` are indexed
up front, since they map directly to the attribution questions already in the README ("cost by
tenant/app," "total cost of one workflow"). `region_id`/`environment`/`module_id`/
`process_or_user_id` are left unindexed until real dashboard query patterns justify the
write-cost of an index on every insert.

## File-based audit logging

Postgres (`requests` table) is the "must have" record and is always on. File-based audit
logging is a **supplemental, opt-in** sink for enterprises that consume logs via a SIEM (Splunk,
etc.) tailing a rotating file — off by default, controlled entirely by env vars
(`FILE_LOGGING_ENABLED`, `LOG_DIR`, `LOG_MAX_SIZE`; see [Environment
variables](#environment-variables)). Implementation: `src/logging/auditLog.ts`.

**One JSON line per call**, not four separate lines for received/forwarded/response/returned —
splitting those apart would force whoever's reading the file (human or SIEM correlation rule) to
reassemble a single call from multiple physically separate lines, which gets genuinely ambiguous
once concurrent or identical-looking calls are in the file at once. Instead, the whole lifecycle
is one record:

```json
{
  "requestId": "1da2db2c-ef18-44e9-89fa-8dfe2cf2b292",
  "provider": "openrouter",
  "requestedModel": "openrouter/openai/gpt-4o-mini",
  "resolvedModelId": "openai/gpt-4o-mini",
  "status": "success",
  "httpStatusCode": 200,
  "errorMessage": null,
  "latencyMs": 632,
  "attribution": { "tenantId": "tenant_enterprise_apple", "...": "..." },
  "usage": { "promptTokens": 13, "completionTokens": 9, "cost": 0.00000735, "...": "..." },
  "callerRequest": { "model": "openrouter/openai/gpt-4o-mini", "messages": ["..."] },
  "providerRequest": { "model": "openai/gpt-4o-mini", "messages": ["..."] },
  "providerResponse": { "...": "the raw response from OpenRouter" },
  "callerResponse": { "...": "what was actually sent back to the caller" }
}
```

`providerResponse` and `callerResponse` are identical in v1 (responses are passed through
unmodified) but kept as distinct fields deliberately — they won't necessarily stay identical
once response transformation, streaming, or cross-provider normalization exist, and the schema
shouldn't need to change shape when that happens.

**The shared `requestId`.** Fastify's `genReqId` is overridden in `server.ts` to generate a real
UUID (`crypto.randomUUID()`) instead of Fastify's default per-process counter (`req-1`, `req-2`,
...) — which isn't safe to correlate with anyway, since it resets on every restart and would
collide across multiple gateway instances behind a load balancer. That UUID is the _same_ value
in three places for one call: Fastify's own Pino request logs, this audit log entry, and the
`request_id` column on the corresponding Postgres row (unique-indexed) — so any of the three can
be used to pivot into the other two.

**Rotation:** pure size-based, via Winston's built-in `File` transport `maxsize` option (not the
`winston-daily-rotate-file` package, which bundles in date-based rotation whether you want it or
not) — `LOG_MAX_SIZE` (default `10m`) is parsed from a human-readable size string into bytes.
When exceeded, Winston opens a new numbered file (`aifinops-audit.log` → `aifinops-audit1.log` →
`aifinops-audit2.log` → ...). **Retention is deliberately uncapped** — no `maxFiles` is set, so
rotated files accumulate forever; that's a product decision, not an oversight, so plan disk
capacity accordingly if you enable this in a long-running deployment.

**Failure contract:** `logAudit()` never throws — a write failure is caught and printed to
server logs, exactly like `logRequest()`'s contract for Postgres. Unlike the Postgres insert
(which is `await`ed before the caller gets a response, so the row is guaranteed to exist first),
Winston's own API is fire-and-forget from the caller's side — the write itself still happens
asynchronously under the hood.

## Health endpoint

`GET /health` — no auth, safe to expose publicly, reports no secrets or business data:

```json
{
  "status": "ok",
  "version": "0.1.1",
  "uptimeSeconds": 3421,
  "database": "reachable",
  "providers": { "openrouter": "ready" }
}
```

Returns `200` if Postgres is reachable (re-running the same `SELECT 1` check used at boot),
`503` otherwise. `providers` reflects `getProviderReadiness()` per provider in
`config/providers.json` — informational only, it does not affect the status code or HTTP status.
Implementation: `src/routes/health.ts`.

## Extending AiFinOps — adding a new provider

`src/transformers/types.ts` defines the seam the whole architecture is built around:

```ts
interface ProviderTransformer {
  readonly providerName: string;
  buildRequest(params: BuildRequestParams): OutboundRequest;
  parseResponse(rawResponse: unknown): ParsedResponse;
}
```

`buildRequest` turns our internal (OpenAI-shaped) request into whatever the upstream provider
actually expects; `parseResponse` validates and normalizes what comes back, extracting usage/cost
for logging. Adding a new provider (Anthropic native, Gemini, etc.) means:

1. Implement `ProviderTransformer` in a new file, e.g. `src/transformers/anthropic.ts`.
2. Add an entry for it in `config/providers.json`.
3. Add its allowed model IDs to `config/providerModelMap.json`.
4. Register an instance of it in `src/transformers/registry.ts`.
5. If it doesn't report cost natively, add its models to `config/modelPricing.json` (see [Model
   pricing](#model-pricing)) — not required for the call to work, only for `cost` to be non-null.

**No changes to `src/routes/chatCompletions.ts` are required** — the route only ever talks to
the `ProviderTransformer` interface, never to a concrete provider. `src/transformers/ollama.ts`
is a real example of this: it's a near-copy of `OpenRouterTransformer` aimed at Ollama's
OpenAI-compatible `/v1/chat/completions` endpoint instead, with no changes needed anywhere else
in the app.

## Development

| Command                                   | Purpose                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                             | Start the gateway with hot reload (`tsx watch`)                         |
| `npm run build`                           | Type-checks and compiles to `dist/` (fails the build on any type error) |
| `npm run start`                           | Runs the compiled build (`node dist/src/server.js`)                     |
| `npm run typecheck`                       | `tsc --noEmit` — no build output, just type errors                      |
| `npm run setup-db`                        | Creates the database (if missing) and the `requests` table              |
| `npm run lint` / `npm run lint:fix`       | ESLint                                                                  |
| `npm run format` / `npm run format:check` | Prettier                                                                |

A Husky pre-commit hook runs `tsc --noEmit` and lint-staged (ESLint) before every commit, so
type errors are caught before they're even committed, not just at build/runtime.

`tsconfig.json` runs with `strict: true`, `noUncheckedIndexedAccess: true`, and
`noImplicitAny: true` — the goal is that a broken provider-string parse, a missing config field,
or a mismatched request/response shape gets caught by `tsc` or by Zod inference, not discovered
from a 500 in production.
