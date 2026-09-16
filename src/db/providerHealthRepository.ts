/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import type { Pool } from 'pg';
import { providers } from '../config/providers.js';

// Requests that reached the provider and consumed tokens (and cost) before failing —
// rate-limited or upstream errors. A 400/401 is rejected before it costs anything, so it
// doesn't count as "wasted" the way 429/500/503 do.
const UPSTREAM_FAILURE_CODES = [429, 500, 503];

export interface ProviderHealthStat {
  provider: string;
  calls: number;
  successRate: number;
  errorRate: number;
  avgLatency: number;
  p95Latency: number;
  wastedSpend: number;
  wastedTokens: number;
  totalSpend: number;
  costPerCall: number;
  avgTokensPerCall: number;
  shareOfSpend: number;
}

interface SnapshotRow {
  provider: string;
  calls: string;
  success_calls: string;
  error_calls: string;
  avg_latency: string | null;
  p95_latency: string | null;
  wasted_spend: string | null;
  wasted_tokens: string | null;
  total_cost: string | null;
  total_tokens_sum: string | null;
}

function zeroStat(provider: string): ProviderHealthStat {
  return {
    provider,
    calls: 0,
    successRate: 0,
    errorRate: 0,
    avgLatency: 0,
    p95Latency: 0,
    wastedSpend: 0,
    wastedTokens: 0,
    totalSpend: 0,
    costPerCall: 0,
    avgTokensPerCall: 0,
    shareOfSpend: 0,
  };
}

/**
 * Rolled up at the provider level, ignoring tenant/app/model — the operational question this
 * answers ("how is this upstream provider actually performing") doesn't have a filter
 * dimension. Every configured provider is included even with zero calls in the window, so a
 * newly-added provider with no traffic yet still shows up as a zeroed row.
 */
export async function getProviderHealthSnapshot(
  pool: Pool,
  windowDays: number,
): Promise<ProviderHealthStat[]> {
  const result = await pool.query<SnapshotRow>(
    `SELECT
       provider,
       COUNT(*)::text AS calls,
       COUNT(*) FILTER (WHERE status = 'success')::text AS success_calls,
       COUNT(*) FILTER (WHERE status = 'error')::text AS error_calls,
       COALESCE(AVG(latency_ms), 0) AS avg_latency,
       COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) AS p95_latency,
       COALESCE(SUM(cost) FILTER (WHERE http_status_code = ANY($2)), 0) AS wasted_spend,
       COALESCE(SUM(total_tokens) FILTER (WHERE http_status_code = ANY($2)), 0) AS wasted_tokens,
       COALESCE(SUM(cost), 0) AS total_cost,
       COALESCE(SUM(total_tokens), 0) AS total_tokens_sum
     FROM requests
     WHERE created_at >= now() - make_interval(days => $1::int)
     GROUP BY provider`,
    [windowDays, UPSTREAM_FAILURE_CODES],
  );

  const byProvider = new Map(result.rows.map((row) => [row.provider, row]));
  const totalOrgCost = result.rows.reduce((sum, row) => sum + Number(row.total_cost ?? 0), 0);

  return Object.keys(providers).map((provider) => {
    const row = byProvider.get(provider);
    if (!row) return zeroStat(provider);

    const calls = Number(row.calls);
    const totalCost = Number(row.total_cost ?? 0);
    const totalTokensSum = Number(row.total_tokens_sum ?? 0);

    return {
      provider,
      calls,
      successRate: calls ? (Number(row.success_calls) / calls) * 100 : 0,
      errorRate: calls ? (Number(row.error_calls) / calls) * 100 : 0,
      avgLatency: Number(row.avg_latency ?? 0),
      p95Latency: Number(row.p95_latency ?? 0),
      wastedSpend: Number(row.wasted_spend ?? 0),
      wastedTokens: Number(row.wasted_tokens ?? 0),
      totalSpend: totalCost,
      costPerCall: calls ? totalCost / calls : 0,
      avgTokensPerCall: calls ? totalTokensSum / calls : 0,
      shareOfSpend: totalOrgCost > 0 ? (totalCost / totalOrgCost) * 100 : 0,
    };
  });
}

export interface ProviderHealthBucketStats {
  count: number;
  errors: number;
  wastedSpend: number;
  latencySum: number;
}

export type ProviderHealthTrendGranularity = 'day' | 'week' | 'month';

export interface ProviderHealthTrendBucket {
  key: string;
  label: string;
  // True for the bucket that "now" falls inside — it's still accumulating data, so
  // period-over-period comparisons exclude it rather than comparing a partial period.
  isCurrent: boolean;
  providers: Record<string, ProviderHealthBucketStats>;
}

export interface ProviderHealthTrends {
  granularity: ProviderHealthTrendGranularity;
  buckets: ProviderHealthTrendBucket[];
}

interface TrendRow {
  bucket: Date;
  provider: string;
  count: string;
  errors: string;
  wasted_spend: string | null;
  latency_sum: string | null;
}

/** Coarser buckets as the window widens, so the chart stays readable — matches the snapshot
 * window options (30/60/90/180/365): 30-60d daily, 90-180d weekly, 365d monthly. */
function granularityForWindow(windowDays: number): ProviderHealthTrendGranularity {
  if (windowDays <= 60) return 'day';
  if (windowDays <= 180) return 'week';
  return 'month';
}

function bucketKey(date: Date, granularity: ProviderHealthTrendGranularity): string {
  return granularity === 'month' ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10);
}

function bucketLabel(date: Date, granularity: ProviderHealthTrendGranularity): string {
  if (granularity === 'month') {
    return date.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function isCurrentBucket(bucketStart: Date, granularity: ProviderHealthTrendGranularity): boolean {
  const now = new Date();
  if (granularity === 'month') {
    return (
      bucketStart.getUTCFullYear() === now.getUTCFullYear() &&
      bucketStart.getUTCMonth() === now.getUTCMonth()
    );
  }
  if (granularity === 'day') {
    return bucketStart.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  }
  const weekEnd = new Date(bucketStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  return bucketStart.getTime() <= now.getTime() && now.getTime() < weekEnd.getTime();
}

/**
 * Scoped to the same window as the snapshot above (unlike the snapshot, which is one rollup
 * for the whole window, this breaks it into buckets to show the trend within it) — bucketed
 * by day/week/month depending on the window's length so the chart stays legible.
 */
export async function getProviderHealthTrends(
  pool: Pool,
  windowDays: number,
): Promise<ProviderHealthTrends> {
  const granularity = granularityForWindow(windowDays);
  const result = await pool.query<TrendRow>(
    `SELECT
       date_trunc($3, created_at) AS bucket,
       provider,
       COUNT(*)::text AS count,
       COUNT(*) FILTER (WHERE status = 'error')::text AS errors,
       COALESCE(SUM(cost) FILTER (WHERE http_status_code = ANY($2)), 0) AS wasted_spend,
       COALESCE(SUM(latency_ms), 0) AS latency_sum
     FROM requests
     WHERE created_at >= now() - make_interval(days => $1::int)
     GROUP BY 1, 2
     ORDER BY 1`,
    [windowDays, UPSTREAM_FAILURE_CODES, granularity],
  );

  const byBucket = new Map<string, ProviderHealthTrendBucket>();
  for (const row of result.rows) {
    const key = bucketKey(row.bucket, granularity);
    let bucket = byBucket.get(key);
    if (!bucket) {
      bucket = {
        key,
        label: bucketLabel(row.bucket, granularity),
        isCurrent: isCurrentBucket(row.bucket, granularity),
        providers: {},
      };
      byBucket.set(key, bucket);
    }
    bucket.providers[row.provider] = {
      count: Number(row.count),
      errors: Number(row.errors),
      wastedSpend: Number(row.wasted_spend ?? 0),
      latencySum: Number(row.latency_sum ?? 0),
    };
  }

  return {
    granularity,
    buckets: [...byBucket.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}
