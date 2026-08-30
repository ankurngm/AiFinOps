/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

/** Escapes one value for a CSV cell per RFC 4180 (quote-wrap on comma/quote/newline). */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

/** Truncated JSON preview for a CSV cell — full-fidelity bodies belong in the JSONL export. */
export function truncateJson(value: unknown, maxLength = 200): string {
  if (value === null || value === undefined) return '';
  const serialized = JSON.stringify(value);
  return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}…` : serialized;
}
