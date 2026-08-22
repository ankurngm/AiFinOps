/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { z } from 'zod';
import type { ProviderConfig } from '../config/providers.js';
import type {
  BuildRequestParams,
  OutboundRequest,
  ParsedResponse,
  ProviderTransformer,
} from './types.js';

// Ollama's OpenAI-compatible /v1/chat/completions endpoint — verified
// against a live local instance. Same shape as OpenAI's own usage object,
// but no cost field: Ollama only ever reports token counts, never price.
// Cost is filled in later (if a config/modelPricing.json entry exists) by
// the route handler, not here.
const usageSchema = z.object({
  prompt_tokens: z.number().nullish(),
  completion_tokens: z.number().nullish(),
  total_tokens: z.number().nullish(),
});

const ollamaResponseSchema = z
  .object({
    id: z.string().optional(),
    object: z.string().optional(),
    model: z.string().optional(),
    choices: z.array(z.unknown()).optional(),
    usage: usageSchema.optional(),
  })
  .passthrough();

/**
 * Handles Ollama's OpenAI-compatible endpoint. One entry/transformer covers
 * both local inference and Ollama Cloud models (":cloud"-suffixed model
 * names) — a local Ollama server proxies cloud-model calls transparently
 * once the host machine has run `ollama signin`, so both cases hit the same
 * baseUrl and need no Authorization header from AiFinOps itself.
 */
export class OllamaTransformer implements ProviderTransformer {
  readonly providerName = 'ollama';

  constructor(private readonly config: ProviderConfig) {}

  buildRequest({ providerModelId, requestBody }: BuildRequestParams): OutboundRequest {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKeyEnvVar) {
      const apiKey = process.env[this.config.apiKeyEnvVar];
      if (!apiKey) {
        throw new Error(
          `Missing API key: environment variable ${this.config.apiKeyEnvVar} is not set`,
        );
      }
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const { model: _originalModel, ...rest } = requestBody;

    return {
      url: `${this.config.baseUrl}/chat/completions`,
      headers,
      body: {
        ...rest,
        model: providerModelId,
      },
    };
  }

  parseResponse(rawResponse: unknown): ParsedResponse {
    const result = ollamaResponseSchema.safeParse(rawResponse);
    if (!result.success) {
      throw new Error(`Unexpected response shape from Ollama: ${result.error.message}`);
    }

    const usage = result.data.usage;

    return {
      body: rawResponse,
      usage: {
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        cachedTokens: null,
        cacheWriteTokens: null,
        reasoningTokens: null,
        cost: null,
        upstreamInferenceCost: null,
      },
    };
  }
}
