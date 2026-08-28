/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { z } from 'zod';
import type { ChatCompletionRequest } from '../schemas/chatCompletionRequest.js';
import type { ProviderConfig } from '../config/providers.js';
import type {
  BuildRequestParams,
  OutboundRequest,
  ParsedResponse,
  ProviderTransformer,
} from './types.js';

// Anthropic's Messages API is a genuinely different native shape from OpenAI's
// chat completions dialect (POST {baseUrl}/messages, "x-api-key" +
// "anthropic-version" headers instead of Bearer auth, a top-level "system"
// string instead of a system-role message, and a mandatory "max_tokens").
// Per ARCHITECTURE.md's guidance on providers that don't fit the OpenAI shape,
// this implements ProviderTransformer directly rather than extending
// OpenAICompatibleTransformer.
const ANTHROPIC_VERSION = '2023-06-01';

// Anthropic requires max_tokens on every request; OpenAI's schema treats it as
// optional. When the caller omits it, fall back to a reasonable default
// rather than rejecting the request or guessing per-model limits.
const DEFAULT_MAX_TOKENS = 4096;

type InboundMessage = ChatCompletionRequest['messages'][number];

function extractText(content: InboundMessage['content']): string | null {
  if (content === null) {
    return null;
  }
  if (typeof content === 'string') {
    return content;
  }
  // Image content parts aren't translated to Anthropic's image block shape —
  // out of scope for this transformer today, same as tool calls below.
  const text = content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
  return text.length > 0 ? text : null;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Only "messages", "system", "max_tokens", and "model" are structurally
// translated below — Anthropic's shapes for those genuinely differ from
// OpenAI's (system is a top-level string, not a message role; max_tokens is
// mandatory; the resolved provider model id replaces "model"), so a request
// would be malformed without translating them. Everything else the caller
// sends — temperature, top_p, top_k, stop, tools, metadata, or any
// parameter Anthropic adds in the future — is forwarded exactly as given.
// AiFinOps doesn't curate which parameters a given Anthropic model accepts;
// that's between the caller and Anthropic, whose own accept/reject decision
// comes back to the caller untouched, same as any other upstream error.
function toAnthropicRequest(
  providerModelId: string,
  requestBody: ChatCompletionRequest,
): Record<string, unknown> {
  const systemParts: string[] = [];
  const messages: AnthropicMessage[] = [];

  for (const message of requestBody.messages) {
    const text = extractText(message.content);
    if (message.role === 'system') {
      if (text) systemParts.push(text);
      continue;
    }
    if (message.role === 'user' || message.role === 'assistant') {
      messages.push({ role: message.role, content: text ?? '' });
    }
    // 'tool' role messages are dropped — Anthropic represents tool results as
    // content blocks within a user message, not a separate role, so
    // faithfully translating a tool-role message is still out of scope for
    // this transformer today. This is unrelated to the pass-through
    // parameters above: it's about which of the caller's *messages* get
    // translated, not which top-level parameters get forwarded.
  }

  return {
    ...requestBody,
    model: providerModelId,
    max_tokens: requestBody.max_tokens ?? DEFAULT_MAX_TOKENS,
    messages,
    ...(systemParts.length > 0 ? { system: systemParts.join('\n\n') } : {}),
  };
}

const anthropicContentBlockSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
});

const anthropicUsageSchema = z.object({
  input_tokens: z.number().nullish(),
  output_tokens: z.number().nullish(),
  cache_creation_input_tokens: z.number().nullish(),
  cache_read_input_tokens: z.number().nullish(),
});

const anthropicResponseSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional(),
    role: z.string().optional(),
    model: z.string().optional(),
    content: z.array(anthropicContentBlockSchema).optional(),
    stop_reason: z.string().nullish(),
    usage: anthropicUsageSchema.optional(),
  })
  .passthrough();

// Anthropic's stop_reason values don't match OpenAI's finish_reason values —
// map the ones with a clear equivalent, default to "stop" for anything else
// (including future stop reasons this transformer doesn't yet know about).
function toFinishReason(stopReason: string | null | undefined): string {
  switch (stopReason) {
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    default:
      return 'stop';
  }
}

/**
 * Handles Anthropic's Messages API directly. Unlike OpenRouter/Ollama/OpenAI,
 * both buildRequest (OpenAI-shaped request -> Anthropic's native shape) and
 * parseResponse (Anthropic's native response -> an OpenAI chat-completion-
 * shaped response) do real translation work here, since Anthropic's API
 * genuinely isn't OpenAI-shaped — the "body" a caller gets back is
 * synthesized from Anthropic's response, not passed through unmodified.
 */
export class AnthropicTransformer implements ProviderTransformer {
  readonly providerName = 'anthropic';

  constructor(private readonly config: ProviderConfig) {}

  buildRequest({ providerModelId, requestBody }: BuildRequestParams): OutboundRequest {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
    };

    if (this.config.apiKeyEnvVar) {
      const apiKey = process.env[this.config.apiKeyEnvVar];
      if (!apiKey) {
        throw new Error(
          `Missing API key: environment variable ${this.config.apiKeyEnvVar} is not set`,
        );
      }
      headers['x-api-key'] = apiKey;
    }

    return {
      url: `${this.config.baseUrl}/messages`,
      headers,
      body: toAnthropicRequest(providerModelId, requestBody),
    };
  }

  parseResponse(rawResponse: unknown): ParsedResponse {
    const result = anthropicResponseSchema.safeParse(rawResponse);
    if (!result.success) {
      throw new Error(`Unexpected response shape from Anthropic: ${result.error.message}`);
    }

    const data = result.data;
    const usage = data.usage;
    const text = (data.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n');

    const promptTokens = usage?.input_tokens ?? null;
    const completionTokens = usage?.output_tokens ?? null;

    return {
      body: {
        id: data.id ?? null,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: data.model ?? null,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: text },
            finish_reason: toFinishReason(data.stop_reason),
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens:
            promptTokens !== null && completionTokens !== null
              ? promptTokens + completionTokens
              : null,
        },
      },
      usage: {
        promptTokens,
        completionTokens,
        totalTokens:
          promptTokens !== null && completionTokens !== null
            ? promptTokens + completionTokens
            : null,
        cachedTokens: usage?.cache_read_input_tokens ?? null,
        cacheWriteTokens: usage?.cache_creation_input_tokens ?? null,
        reasoningTokens: null,
        cost: null,
        upstreamInferenceCost: null,
      },
    };
  }
}
