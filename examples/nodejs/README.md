# Node.js examples

Sample scripts showing how to call AiFinOps from Node.js. None of these are installed as
dependencies of the main project.

**Prerequisite:** the gateway must already be running (`npm run dev` from the repo root), with
at least one provider configured (see the root [README](../../README.md#-get-started)). By
default these scripts point at `http://localhost:8787`; set the `AIFINOPS_URL` environment
variable to point elsewhere. The `ollama-*` examples additionally need Ollama running locally
with `llama3.2:3b` pulled (`ollama pull llama3.2:3b`) and provisioned in
`config/providerModelMap.json`.

| File                                          | What it shows                                                                                   | Needs                        | Real cost?                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------- |
| `basic-chat-completion.js`                    | Minimal call, no attribution                                                                    | Nothing (Node 18+ `fetch`)   | Yes — a real OpenRouter call      |
| `chat-completion-with-attribution.js`         | Same call, tagged with all 7 `AiFinOps-*` attribution headers                                   | Nothing                      | Yes — a real OpenRouter call      |
| `rejected-unprovisioned-model.js`             | Calling a model not on the allow-list — shows the `400`, and that no cost is incurred           | Nothing                      | No — rejected before the provider |
| `using-openai-sdk.js`                         | Pointing the official `openai` npm SDK at AiFinOps via `baseURL` — proves drop-in compatibility | `openai` package (see below) | Yes — a real OpenRouter call      |
| `ollama-chat-completion-with-attribution.js`  | Same attribution call as above, but against a local Ollama model instead of OpenRouter          | Nothing                      | No — Ollama is local/free         |
| `ollama-using-openai-sdk-with-attribution.js` | The `openai` SDK example above, pointed at a local Ollama model instead of OpenRouter           | `openai` package (see below) | No — Ollama is local/free         |

Run any of the zero-dependency examples directly:

```bash
node basic-chat-completion.js
```

`using-openai-sdk.js` and `ollama-using-openai-sdk-with-attribution.js` need one extra package
that this repo does **not** install for you. Install it locally in this folder before running
either of them:

```bash
cd examples/nodejs
npm install openai
node using-openai-sdk.js
```

The OpenRouter examples all use `openai/gpt-4o-mini`, so each run costs a small fraction of a
cent — real spend on your OpenRouter account, not simulated. The `ollama-*` examples don't cost
anything, since they call a local model priced at `$0` by `config/modelPricing.json`'s wildcard
entry.
