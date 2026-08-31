/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);

const parseableDate = nonEmptyString.refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'must be a parseable date',
);

export const logsFiltersSchema = z.object({
  startDate: parseableDate.optional(),
  endDate: parseableDate.optional(),
  provider: nonEmptyString.optional(),
  resolvedModelId: nonEmptyString.optional(),
  status: z.enum(['success', 'error']).optional(),
  regionId: nonEmptyString.optional(),
  environment: nonEmptyString.optional(),
  tenantId: nonEmptyString.optional(),
  applicationId: nonEmptyString.optional(),
  moduleId: nonEmptyString.optional(),
  processOrUserId: nonEmptyString.optional(),
  transactionId: nonEmptyString.optional(),
});

export type LogsFilters = z.infer<typeof logsFiltersSchema>;

export const logsListQuerySchema = logsFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type LogsListQuery = z.infer<typeof logsListQuerySchema>;

export const logIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'id must be numeric'),
});
