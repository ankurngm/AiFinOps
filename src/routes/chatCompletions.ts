/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { chatCompletionRequestSchema } from '../schemas/chatCompletionRequest.js';
import { attributionHeadersSchema, toAttribution } from '../schemas/attribution.js';
import { getProvider } from '../config/providers.js';
import { isModelProvisioned } from '../config/providerModelMap.js';
import { getTransformer } from '../transformers/registry.js';
import { pool } from '../db/pool.js';
import { logRequest, type RequestLogEntry } from '../db/logRequest.js';

const EMPTY_USAGE = {
  promptTokens: null,
  completionTokens: null,
  totalTokens: null,
  cachedTokens: null,
  cacheWriteTokens: null,
  reasoningTokens: null,
  cost: null,
  upstreamInferenceCost: null,
} as const;

export async function chatCompletionsRoute(app: FastifyInstance): Promise<void> {
  app.post('/v1/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
    const attributionResult = attributionHeadersSchema.safeParse(request.headers);
    if (!attributionResult.success) {
      return reply.status(400).send({
        error: 'invalid attribution headers',
        details: attributionResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    const attribution = toAttribution(attributionResult.data);

    const parseResult = chatCompletionRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'invalid request body',
        details: parseResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const body = parseResult.data;

    if (body.stream) {
      return reply.status(400).send({
        error: 'streaming is not yet supported in this version of AiFinOps',
      });
    }

    const firstSlash = body.model.indexOf('/');
    if (firstSlash === -1) {
      return reply.status(400).send({
        error: `model must be in "provider/model" form, got: ${body.model}`,
      });
    }
    const provider = body.model.slice(0, firstSlash);
    const providerModelId = body.model.slice(firstSlash + 1);

    const providerConfig = getProvider(provider);
    if (!providerConfig) {
      return reply.status(400).send({ error: `provider not provisioned: ${provider}` });
    }

    if (!isModelProvisioned(provider, providerModelId)) {
      return reply.status(400).send({
        error: `model not provisioned for provider ${provider}: ${providerModelId}`,
      });
    }

    const transformer = getTransformer(provider);
    if (!transformer) {
      return reply
        .status(500)
        .send({ error: `no transformer registered for provider: ${provider}` });
    }

    const startedAt = performance.now();

    let outbound;
    try {
      outbound = transformer.buildRequest({ providerModelId, requestBody: body });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startedAt);
      const errorMessage = err instanceof Error ? err.message : String(err);
      const logEntry: RequestLogEntry = {
        provider,
        requestedModel: body.model,
        resolvedModelId: providerModelId,
        requestBody: body,
        responseBody: null,
        status: 'error',
        httpStatusCode: null,
        errorMessage,
        ...EMPTY_USAGE,
        ...attribution,
        latencyMs,
      };
      await logRequest(pool, logEntry);
      return reply.status(500).send({ error: `provider not configured: ${errorMessage}` });
    }

    const baseLogEntry = {
      provider,
      requestedModel: body.model,
      resolvedModelId: providerModelId,
      requestBody: outbound.body,
      ...attribution,
    };

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(outbound.url, {
        method: 'POST',
        headers: outbound.headers,
        body: JSON.stringify(outbound.body),
      });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startedAt);
      const errorMessage = err instanceof Error ? err.message : String(err);
      const logEntry: RequestLogEntry = {
        ...baseLogEntry,
        responseBody: null,
        status: 'error',
        httpStatusCode: null,
        errorMessage,
        ...EMPTY_USAGE,
        latencyMs,
      };
      await logRequest(pool, logEntry);
      return reply.status(502).send({ error: `failed to reach provider: ${errorMessage}` });
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    const rawText = await upstreamResponse.text();
    let rawJson: unknown = null;
    try {
      rawJson = rawText.length > 0 ? JSON.parse(rawText) : null;
    } catch {
      rawJson = { nonJsonBody: rawText };
    }

    if (!upstreamResponse.ok) {
      const errorMessage =
        typeof rawJson === 'object' && rawJson !== null && 'error' in rawJson
          ? JSON.stringify((rawJson as Record<string, unknown>).error)
          : `upstream returned ${upstreamResponse.status}`;

      const logEntry: RequestLogEntry = {
        ...baseLogEntry,
        responseBody: rawJson,
        status: 'error',
        httpStatusCode: upstreamResponse.status,
        errorMessage,
        ...EMPTY_USAGE,
        latencyMs,
      };
      await logRequest(pool, logEntry);
      return reply.status(upstreamResponse.status).send(rawJson);
    }

    let parsed;
    try {
      parsed = transformer.parseResponse(rawJson);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const logEntry: RequestLogEntry = {
        ...baseLogEntry,
        responseBody: rawJson,
        status: 'error',
        httpStatusCode: upstreamResponse.status,
        errorMessage,
        ...EMPTY_USAGE,
        latencyMs,
      };
      await logRequest(pool, logEntry);
      return reply.status(502).send({ error: `invalid response from provider: ${errorMessage}` });
    }

    const logEntry: RequestLogEntry = {
      ...baseLogEntry,
      responseBody: parsed.body,
      status: 'success',
      httpStatusCode: upstreamResponse.status,
      errorMessage: null,
      promptTokens: parsed.usage.promptTokens,
      completionTokens: parsed.usage.completionTokens,
      totalTokens: parsed.usage.totalTokens,
      cachedTokens: parsed.usage.cachedTokens,
      cacheWriteTokens: parsed.usage.cacheWriteTokens,
      reasoningTokens: parsed.usage.reasoningTokens,
      cost: parsed.usage.cost,
      upstreamInferenceCost: parsed.usage.upstreamInferenceCost,
      latencyMs,
    };
    await logRequest(pool, logEntry);

    return reply.status(upstreamResponse.status).send(parsed.body);
  });
}
