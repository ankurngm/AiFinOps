/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import type { ProviderConfig } from '../config/providers.js';
import type {
  BuildRequestParams,
  OutboundRequest,
  ParsedResponse,
  ProviderTransformer,
} from './types.js';

/**
 * Shared base for any provider whose HTTP surface mirrors OpenAI's chat
 * completions endpoint: POST {baseUrl}/chat/completions, an optional
 * Bearer-token Authorization header, and `model` swapped for the resolved
 * provider-native id. Common enough in the LLM ecosystem (OpenRouter,
 * Ollama, and many self-hosted/compatible inference servers all speak this
 * exact dialect) that buildRequest is identical across every transformer
 * extending it today — not a hypothetical, both current transformers had
 * the exact same implementation before this was extracted.
 *
 * parseResponse is deliberately NOT templated here — response shape (usage
 * fields, whether cost is reported, nested detail objects) genuinely
 * differs per provider, so each subclass implements it directly rather
 * than forcing real differences into a generic shape.
 *
 * A provider whose request-building deviates from this pattern (a
 * different auth header style, a different endpoint path) can simply
 * override buildRequest itself — normal inheritance, no extra hook
 * methods added ahead of an actual need for them.
 */
export abstract class OpenAICompatibleTransformer implements ProviderTransformer {
  abstract readonly providerName: string;

  constructor(protected readonly config: ProviderConfig) {}

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

  abstract parseResponse(rawResponse: unknown): ParsedResponse;
}
