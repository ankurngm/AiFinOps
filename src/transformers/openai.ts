/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { z } from 'zod';
import { OpenAICompatibleTransformer } from './openAICompatibleTransformer.js';
import type { ParsedResponse } from './types.js';

// OpenAI's own chat completions endpoint — the dialect every other
// "OpenAI-compatible" provider is imitating. Usage reports token counts and,
// for supported models, cached and reasoning token breakdowns — but never a
// cost figure: OpenAI, unlike OpenRouter, doesn't self-report price. Cost is
// filled in later (from config/modelPricing.json) by the route handler.
const usageSchema = z.object({
  prompt_tokens: z.number().nullish(),
  completion_tokens: z.number().nullish(),
  total_tokens: z.number().nullish(),
  prompt_tokens_details: z
    .object({
      cached_tokens: z.number().nullish(),
    })
    .nullish(),
  completion_tokens_details: z
    .object({
      reasoning_tokens: z.number().nullish(),
    })
    .nullish(),
});

const openAIResponseSchema = z
  .object({
    id: z.string().optional(),
    object: z.string().optional(),
    model: z.string().optional(),
    choices: z.array(z.unknown()).optional(),
    usage: usageSchema.optional(),
  })
  .passthrough();

/**
 * Handles OpenAI's own Chat Completions endpoint directly (as opposed to
 * OpenRouter, which fronts it). buildRequest is inherited unchanged from
 * OpenAICompatibleTransformer — same POST {baseUrl}/chat/completions shape,
 * same Bearer auth.
 */
export class OpenAITransformer extends OpenAICompatibleTransformer {
  readonly providerName = 'openai';

  parseResponse(rawResponse: unknown): ParsedResponse {
    const result = openAIResponseSchema.safeParse(rawResponse);
    if (!result.success) {
      throw new Error(`Unexpected response shape from OpenAI: ${result.error.message}`);
    }

    const usage = result.data.usage;

    return {
      body: rawResponse,
      usage: {
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? null,
        cacheWriteTokens: null,
        reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? null,
        cost: null,
        upstreamInferenceCost: null,
      },
    };
  }
}
