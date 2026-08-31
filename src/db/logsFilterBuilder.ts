/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import type { LogsFilters } from '../schemas/logsQuery.js';

// Exact-match filters map directly to an indexed or low-cardinality column.
const EXACT_FIELDS: Array<{ key: keyof LogsFilters; column: string }> = [
  { key: 'provider', column: 'provider' },
  { key: 'resolvedModelId', column: 'resolved_model_id' },
  { key: 'status', column: 'status' },
];

// Free-form attribution fields are matched as a Splunk-style substring
// search rather than an exact-match dropdown — there's no bounded set of
// values to offer as options.
const CONTAINS_FIELDS: Array<{ key: keyof LogsFilters; column: string }> = [
  { key: 'regionId', column: 'region_id' },
  { key: 'environment', column: 'environment' },
  { key: 'tenantId', column: 'tenant_id' },
  { key: 'applicationId', column: 'application_id' },
  { key: 'moduleId', column: 'module_id' },
  { key: 'processOrUserId', column: 'process_or_user_id' },
  { key: 'transactionId', column: 'transaction_id' },
];

// Escapes LIKE/ILIKE metacharacters in user input before it's wrapped in
// wildcards, so a literal search for e.g. "50%" matches that text instead
// of being interpreted as a pattern.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export interface LogsWhereClause {
  whereSql: string;
  params: unknown[];
}

/**
 * Builds a parameterized WHERE clause from validated filters. Column names
 * are always hardcoded string literals in this function's body, never
 * derived from request input — only values are ever passed as $n
 * parameters, so there is no SQL-injection surface.
 */
export function buildLogsWhereClause(filters: LogsFilters): LogsWhereClause {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.startDate) {
    params.push(filters.startDate);
    clauses.push(`created_at >= $${params.length}::timestamptz`);
  }
  if (filters.endDate) {
    params.push(filters.endDate);
    clauses.push(`created_at <= $${params.length}::timestamptz`);
  }

  for (const { key, column } of EXACT_FIELDS) {
    const value = filters[key];
    if (value) {
      params.push(value);
      clauses.push(`${column} = $${params.length}`);
    }
  }

  for (const { key, column } of CONTAINS_FIELDS) {
    const value = filters[key];
    if (value) {
      params.push(`%${escapeLikePattern(value)}%`);
      clauses.push(`${column} ILIKE $${params.length} ESCAPE '\\'`);
    }
  }

  return { whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '', params };
}
