# Node.js examples

Sample scripts showing how to call AiFinOps from Node.js. None of these are installed as
dependencies of the main project.

**Prerequisite:** the gateway must already be running (`npm run dev` from the repo root), with
at least one provider configured (see the root [README](../../README.md#-get-started)). By
default these scripts point at `http://localhost:8787`; set the `AIFINOPS_URL` environment
variable to point elsewhere.

| File                                  | What it shows                                                                                   | Needs                        | Real cost?                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------- |
| `basic-chat-completion.js`            | Minimal call, no attribution                                                                    | Nothing (Node 18+ `fetch`)   | Yes — a real OpenRouter call      |
| `chat-completion-with-attribution.js` | Same call, tagged with all 7 `AiFinOps-*` attribution headers                                   | Nothing                      | Yes — a real OpenRouter call      |
| `rejected-unprovisioned-model.js`     | Calling a model not on the allow-list — shows the `400`, and that no cost is incurred           | Nothing                      | No — rejected before the provider |
| `using-openai-sdk.js`                 | Pointing the official `openai` npm SDK at AiFinOps via `baseURL` — proves drop-in compatibility | `openai` package (see below) | Yes — a real OpenRouter call      |

Run any of the zero-dependency examples directly:

```bash
node basic-chat-completion.js
```

`using-openai-sdk.js` needs one extra package that this repo does **not** install for you.
Install it locally in this folder before running that one file:

```bash
cd examples/nodejs
npm install openai
node using-openai-sdk.js
```

The "real cost" calls all use `openai/gpt-4o-mini`, so each run costs a small fraction of a
cent — but it's real spend on your OpenRouter account, not simulated.
