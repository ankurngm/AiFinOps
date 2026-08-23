/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { z } from 'zod';

// Read from request.headers (Fastify/Node lowercase incoming header names).
// All optional — callers may send none, some, or all of these. None of them
// are ever forwarded to the LLM provider; they exist purely for cost
// attribution in the requests table.
export const attributionHeadersSchema = z.object({
  'aifinops-region-id': z.string().max(255).optional(),
  'aifinops-environment': z.string().max(255).optional(),
  'aifinops-tenant-id': z.string().max(255).optional(),
  'aifinops-application-id': z.string().max(255).optional(),
  'aifinops-module-id': z.string().max(255).optional(),
  'aifinops-process-or-user-id': z.string().max(255).optional(),
  'aifinops-transaction-id': z.string().max(255).optional(),
});

export type AttributionHeaders = z.infer<typeof attributionHeadersSchema>;

export interface Attribution {
  regionId: string | null;
  environment: string | null;
  tenantId: string | null;
  applicationId: string | null;
  moduleId: string | null;
  processOrUserId: string | null;
  transactionId: string | null;
}

export function toAttribution(headers: AttributionHeaders): Attribution {
  return {
    regionId: headers['aifinops-region-id'] ?? null,
    environment: headers['aifinops-environment'] ?? null,
    tenantId: headers['aifinops-tenant-id'] ?? null,
    applicationId: headers['aifinops-application-id'] ?? null,
    moduleId: headers['aifinops-module-id'] ?? null,
    processOrUserId: headers['aifinops-process-or-user-id'] ?? null,
    transactionId: headers['aifinops-transaction-id'] ?? null,
  };
}
