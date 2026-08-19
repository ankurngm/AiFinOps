import { z } from 'zod';
import type { ProviderConfig } from '../config/providers.js';
import type {
  BuildRequestParams,
  OutboundRequest,
  ParsedResponse,
  ProviderTransformer,
} from './types.js';

const usageSchema = z.object({
  prompt_tokens: z.number().nullish(),
  completion_tokens: z.number().nullish(),
  total_tokens: z.number().nullish(),
  cost: z.number().nullish(),
  prompt_tokens_details: z
    .object({
      cached_tokens: z.number().nullish(),
      cache_write_tokens: z.number().nullish(),
    })
    .nullish(),
  completion_tokens_details: z
    .object({
      reasoning_tokens: z.number().nullish(),
    })
    .nullish(),
  cost_details: z
    .object({
      upstream_inference_cost: z.number().nullish(),
    })
    .nullish(),
});

const openRouterResponseSchema = z
  .object({
    id: z.string().optional(),
    object: z.string().optional(),
    model: z.string().optional(),
    choices: z.array(z.unknown()).optional(),
    usage: usageSchema.optional(),
  })
  .passthrough();

/**
 * V1's only provider transformer. Handles OpenRouter's chat completions
 * endpoint, which is already OpenAI-shaped — we mostly pass the body
 * through, swapping our own "provider/model" prefix for OpenRouter's
 * native "vendor/model" id, and extract usage/cost for logging.
 */
export class OpenRouterTransformer implements ProviderTransformer {
  readonly providerName = 'openrouter';

  constructor(private readonly config: ProviderConfig) {}

  buildRequest({ providerModelId, requestBody }: BuildRequestParams): OutboundRequest {
    const apiKey = process.env[this.config.apiKeyEnvVar];
    if (!apiKey) {
      throw new Error(
        `Missing API key: environment variable ${this.config.apiKeyEnvVar} is not set`,
      );
    }

    const { model: _originalModel, ...rest } = requestBody;

    return {
      url: `${this.config.baseUrl}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        ...rest,
        model: providerModelId,
      },
    };
  }

  parseResponse(rawResponse: unknown): ParsedResponse {
    const result = openRouterResponseSchema.safeParse(rawResponse);
    if (!result.success) {
      throw new Error(`Unexpected response shape from OpenRouter: ${result.error.message}`);
    }

    const usage = result.data.usage;

    return {
      body: rawResponse,
      usage: {
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? null,
        cacheWriteTokens: usage?.prompt_tokens_details?.cache_write_tokens ?? null,
        reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? null,
        cost: usage?.cost ?? null,
        upstreamInferenceCost: usage?.cost_details?.upstream_inference_cost ?? null,
      },
    };
  }
}
