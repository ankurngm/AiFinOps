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
import { logAudit } from '../logging/auditLog.js';
import { getCurrentPricing, computeCost } from '../config/modelPricing.js';

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
      const callerResponse = { error: `provider not configured: ${errorMessage}` };
      const logEntry: RequestLogEntry = {
        requestId: request.id,
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
      logAudit({
        requestId: request.id,
        provider,
        requestedModel: body.model,
        resolvedModelId: providerModelId,
        status: 'error',
        httpStatusCode: null,
        errorMessage,
        latencyMs,
        attribution,
        usage: EMPTY_USAGE,
        callerRequest: body,
        providerRequest: null,
        providerResponse: null,
        callerResponse,
      });
      return reply.status(500).send(callerResponse);
    }

    const baseLogEntry = {
      requestId: request.id,
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
      const callerResponse = { error: `failed to reach provider: ${errorMessage}` };
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
      logAudit({
        requestId: request.id,
        provider,
        requestedModel: body.model,
        resolvedModelId: providerModelId,
        status: 'error',
        httpStatusCode: null,
        errorMessage,
        latencyMs,
        attribution,
        usage: EMPTY_USAGE,
        callerRequest: body,
        providerRequest: outbound.body,
        providerResponse: null,
        callerResponse,
      });
      return reply.status(502).send(callerResponse);
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
      logAudit({
        requestId: request.id,
        provider,
        requestedModel: body.model,
        resolvedModelId: providerModelId,
        status: 'error',
        httpStatusCode: upstreamResponse.status,
        errorMessage,
        latencyMs,
        attribution,
        usage: EMPTY_USAGE,
        callerRequest: body,
        providerRequest: outbound.body,
        providerResponse: rawJson,
        callerResponse: rawJson,
      });
      return reply.status(upstreamResponse.status).send(rawJson);
    }

    let parsed;
    try {
      parsed = transformer.parseResponse(rawJson);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const callerResponse = { error: `invalid response from provider: ${errorMessage}` };
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
      logAudit({
        requestId: request.id,
        provider,
        requestedModel: body.model,
        resolvedModelId: providerModelId,
        status: 'error',
        httpStatusCode: upstreamResponse.status,
        errorMessage,
        latencyMs,
        attribution,
        usage: EMPTY_USAGE,
        callerRequest: body,
        providerRequest: outbound.body,
        providerResponse: rawJson,
        callerResponse,
      });
      return reply.status(502).send(callerResponse);
    }

    // Fill in cost from config/modelPricing.json when the provider didn't
    // report one natively (e.g. Ollama). Only affects what's logged — the
    // response returned to the caller is never mutated.
    let cost = parsed.usage.cost;
    if (cost === null) {
      const pricing = getCurrentPricing(provider, providerModelId);
      if (pricing) {
        cost = computeCost(pricing, parsed.usage);
      }
    }
    const enrichedUsage = { ...parsed.usage, cost };

    const logEntry: RequestLogEntry = {
      ...baseLogEntry,
      responseBody: parsed.body,
      status: 'success',
      httpStatusCode: upstreamResponse.status,
      errorMessage: null,
      promptTokens: enrichedUsage.promptTokens,
      completionTokens: enrichedUsage.completionTokens,
      totalTokens: enrichedUsage.totalTokens,
      cachedTokens: enrichedUsage.cachedTokens,
      cacheWriteTokens: enrichedUsage.cacheWriteTokens,
      reasoningTokens: enrichedUsage.reasoningTokens,
      cost: enrichedUsage.cost,
      upstreamInferenceCost: enrichedUsage.upstreamInferenceCost,
      latencyMs,
    };
    await logRequest(pool, logEntry);
    logAudit({
      requestId: request.id,
      provider,
      requestedModel: body.model,
      resolvedModelId: providerModelId,
      status: 'success',
      httpStatusCode: upstreamResponse.status,
      errorMessage: null,
      latencyMs,
      attribution,
      usage: enrichedUsage,
      callerRequest: body,
      providerRequest: outbound.body,
      providerResponse: parsed.body,
      callerResponse: parsed.body,
    });

    return reply.status(upstreamResponse.status).send(parsed.body);
  });
}
