/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { providers } from '../config/providers.js';
import { OpenRouterTransformer } from './openrouter.js';
import { OllamaTransformer } from './ollama.js';
import { OpenAITransformer } from './openai.js';
import type { ProviderTransformer } from './types.js';

const transformers = new Map<string, ProviderTransformer>();

if (providers.openrouter) {
  transformers.set('openrouter', new OpenRouterTransformer(providers.openrouter));
}

if (providers.ollama) {
  transformers.set('ollama', new OllamaTransformer(providers.ollama));
}

if (providers.openai) {
  transformers.set('openai', new OpenAITransformer(providers.openai));
}

// Adding a new provider (e.g. Anthropic, Gemini): implement ProviderTransformer
// in a new file, then register an instance here. No changes needed anywhere
// in routes/chatCompletions.ts.

export function getTransformer(providerName: string): ProviderTransformer | undefined {
  return transformers.get(providerName);
}
