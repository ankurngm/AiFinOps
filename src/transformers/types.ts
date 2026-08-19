import type { ChatCompletionRequest } from '../schemas/chatCompletionRequest.js';

export interface BuildRequestParams {
  providerModelId: string;
  requestBody: ChatCompletionRequest;
}

export interface OutboundRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface ParsedUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  cost: number | null;
  upstreamInferenceCost: number | null;
}

export interface ParsedResponse {
  /** The OpenAI-shaped response body to return to the caller, unmodified. */
  body: unknown;
  usage: ParsedUsage;
}

/**
 * A ProviderTransformer knows how to translate between our internal
 * OpenAI-shaped request/response and a specific upstream provider's API.
 * Adding a new provider means implementing this interface and registering
 * it in transformers/registry.ts — routes/chatCompletions.ts never changes.
 */
export interface ProviderTransformer {
  readonly providerName: string;
  buildRequest(params: BuildRequestParams): OutboundRequest;
  parseResponse(rawResponse: unknown): ParsedResponse;
}
