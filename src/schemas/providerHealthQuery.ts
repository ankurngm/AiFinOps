/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import { z } from 'zod';

const WINDOW_DAYS_OPTIONS = [30, 60, 90, 180, 365] as const;

// Shared by the snapshot and trends endpoints — both are scoped to the same "snapshot window"
// toggle on the Provider Health tab.
export const providerHealthWindowQuerySchema = z.object({
  windowDays: z.coerce
    .number()
    .int()
    .refine(
      (value): value is (typeof WINDOW_DAYS_OPTIONS)[number] =>
        (WINDOW_DAYS_OPTIONS as readonly number[]).includes(value),
      `windowDays must be one of ${WINDOW_DAYS_OPTIONS.join(', ')}`,
    )
    .default(90),
});

export type ProviderHealthWindowQuery = z.infer<typeof providerHealthWindowQuerySchema>;
