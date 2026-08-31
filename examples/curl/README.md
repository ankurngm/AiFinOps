# curl examples

Sample shell scripts showing how to call AiFinOps with plain curl — no language runtime needed
beyond curl and bash, both already on virtually every machine.

**Prerequisite:** the gateway must already be running (`npm run dev` from the repo root), with
at least one provider configured (see the root [README](../../README.md#-get-started)). By
default these scripts point at `http://localhost:8787`; set the `AIFINOPS_URL` environment
variable to point elsewhere. The `ollama-*` script additionally needs Ollama running locally
with `llama3.2:3b` pulled (`ollama pull llama3.2:3b`) and provisioned in
`config/providerModelMap.json`. The `openai-*` script additionally needs `OPENAI_API_KEY` set in
`.env`, and the `anthropic-*` script needs `ANTHROPIC_API_KEY` set in `.env`.

| File                                            | What it shows                                                                         | Real cost?                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| `basic-chat-completion.sh`                      | Minimal call, no attribution                                                          | Yes — a real OpenRouter call      |
| `chat-completion-with-attribution.sh`           | Same call, tagged with all 7 `AiFinOps-*` attribution headers                         | Yes — a real OpenRouter call      |
| `rejected-unprovisioned-model.sh`               | Calling a model not on the allow-list — shows the `400`, and that no cost is incurred | No — rejected before the provider |
| `ollama-chat-completion-with-attribution.sh`    | Same attribution call, but against a local Ollama model instead of OpenRouter         | No — Ollama is local/free         |
| `openai-chat-completion-with-attribution.sh`    | Same attribution call, but against OpenAI directly instead of via OpenRouter          | Yes — a real OpenAI call          |
| `anthropic-chat-completion-with-attribution.sh` | Same attribution call, but against Anthropic directly instead of via OpenRouter       | Yes — a real Anthropic call       |

Make them executable once, then run directly:

```bash
chmod +x *.sh
./basic-chat-completion.sh
```

Or run any of them without `chmod` via bash directly:

```bash
bash basic-chat-completion.sh
```

The OpenRouter scripts both use `openai/gpt-4o-mini`, so each run costs a small fraction of a
cent — real spend on your OpenRouter account, not simulated. `openai-chat-completion-with-attribution.sh`
also uses `gpt-4o-mini`, this time billed directly to your OpenAI account.
`anthropic-chat-completion-with-attribution.sh` uses `claude-haiku-4-5-20251001`, Anthropic's
smallest current model, billed to your Anthropic account. `ollama-chat-completion-with-attribution.sh`
doesn't cost anything, since it calls a local model priced at `$0` by `config/modelPricing.json`'s
wildcard entry.
