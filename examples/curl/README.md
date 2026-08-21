# curl examples

Sample shell scripts showing how to call AiFinOps with plain curl — no language runtime needed
beyond curl and bash, both already on virtually every machine.

**Prerequisite:** the gateway must already be running (`npm run dev` from the repo root), with
at least one provider configured (see the root [README](../../README.md#-get-started)). By
default these scripts point at `http://localhost:8787`; set the `AIFINOPS_URL` environment
variable to point elsewhere.

| File                                  | What it shows                                                                         | Real cost?                        |
| ------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| `basic-chat-completion.sh`            | Minimal call, no attribution                                                          | Yes — a real OpenRouter call      |
| `chat-completion-with-attribution.sh` | Same call, tagged with all 7 `AiFinOps-*` attribution headers                         | Yes — a real OpenRouter call      |
| `rejected-unprovisioned-model.sh`     | Calling a model not on the allow-list — shows the `400`, and that no cost is incurred | No — rejected before the provider |

Make them executable once, then run directly:

```bash
chmod +x *.sh
./basic-chat-completion.sh
```

Or run any of them without `chmod` via bash directly:

```bash
bash basic-chat-completion.sh
```

The "real cost" calls both use `openai/gpt-4o-mini`, so each run costs a small fraction of a
cent — but it's real spend on your OpenRouter account, not simulated.
