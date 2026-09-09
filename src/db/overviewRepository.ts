/**
 * Copyright (C) 2026 Ankur Nigam
 * Licensed under the Elastic License 2.0, plus a supplemental attribution term.
 * See the LICENSE file in the project root for full terms.
 * https://github.com/ankurngm/AiFinOps
 */

import type { Pool } from 'pg';
import type { LogsFilters } from '../schemas/logsQuery.js';
import { buildLogsWhereClause } from './logsFilterBuilder.js';

const NONE_LABEL = '(none)';

export interface NamedAmount {
  name: string;
  cost: number;
  calls: number;
  pct: number;
}

export interface OverviewSummary {
  spend: { current: number; deltaPct: number | null };
  requests: { current: number; deltaPct: number | null };
  avgCostPerRequest: { current: number | null; deltaPct: number | null };
  activeModels: number;
  dailySpendByProvider: Array<{ date: string; provider: string; cost: number }>;
  topModelsBySpend: NamedAmount[];
  providerMix: NamedAmount[];
}

export interface OverviewDetails {
  kpis: {
    totalSpend: number;
    totalCalls: number;
    wastedSpend: number;
    wastedPct: number;
    activeTenants: number;
    spendDeltaPct: number | null;
  };
  topSpenders: {
    tenant: NamedAmount[];
    application: NamedAmount[];
    user: NamedAmount[];
  };
  breakdownByProvider: NamedAmount[];
  breakdownByModel: NamedAmount[];
  chargebackByApplication: Array<{
    name: string;
    calls: number;
    cost: number;
    wasted: number;
    wastedPct: number | null;
  }>;
}

function pctDelta(current: number, prior: number): number | null {
  return prior > 0 ? ((current - prior) / prior) * 100 : null;
}

/** Folds a cost-sorted list into its top N plus one "Other (k models)" row for the remainder. */
function topNPlusOther(
  rows: Array<{ name: string; cost: number; calls: number }>,
  n: number,
  totalCost: number,
): NamedAmount[] {
  const top = rows.slice(0, n);
  const rest = rows.slice(n);
  const withPct = top.map((row) => ({
    ...row,
    pct: totalCost > 0 ? (row.cost / totalCost) * 100 : 0,
  }));
  if (rest.length === 0) return withPct;

  const restCost = rest.reduce((sum, row) => sum + row.cost, 0);
  const restCalls = rest.reduce((sum, row) => sum + row.calls, 0);
  withPct.push({
    name: `Other (${rest.length} models)`,
    cost: restCost,
    calls: restCalls,
    pct: totalCost > 0 ? (restCost / totalCost) * 100 : 0,
  });
  return withPct;
}

/**
 * Fixed 30-day snapshot, deliberately unaffected by the Details filter — the standard
 * pulse-check everyone glances at first, always comparable day over day.
 */
export async function getOverviewSummary(pool: Pool): Promise<OverviewSummary> {
  const [currentTotals, priorTotals, activeModels, daily, models, providers] = await Promise.all([
    pool.query<{ cost: string | null; requests: string }>(
      `SELECT COALESCE(SUM(cost), 0) AS cost, COUNT(*)::text AS requests
       FROM requests WHERE created_at >= now() - interval '30 days'`,
    ),
    pool.query<{ cost: string | null; requests: string }>(
      `SELECT COALESCE(SUM(cost), 0) AS cost, COUNT(*)::text AS requests
       FROM requests
       WHERE created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days'`,
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT resolved_model_id)::text AS count
       FROM requests WHERE created_at >= now() - interval '30 days'`,
    ),
    pool.query<{ day: Date; provider: string; cost: string | null }>(
      `SELECT date_trunc('day', created_at) AS day, provider, COALESCE(SUM(cost), 0) AS cost
       FROM requests
       WHERE created_at >= now() - interval '14 days'
       GROUP BY 1, 2
       ORDER BY 1`,
    ),
    pool.query<{ resolved_model_id: string; cost: string | null; requests: string }>(
      `SELECT resolved_model_id, COALESCE(SUM(cost), 0) AS cost, COUNT(*)::text AS requests
       FROM requests
       WHERE created_at >= now() - interval '30 days'
       GROUP BY resolved_model_id
       ORDER BY COALESCE(SUM(cost), 0) DESC`,
    ),
    pool.query<{ provider: string; cost: string | null; requests: string }>(
      `SELECT provider, COALESCE(SUM(cost), 0) AS cost, COUNT(*)::text AS requests
       FROM requests
       WHERE created_at >= now() - interval '30 days'
       GROUP BY provider
       ORDER BY COALESCE(SUM(cost), 0) DESC`,
    ),
  ]);

  const currentCost = Number(currentTotals.rows[0]?.cost ?? 0);
  const currentRequests = Number(currentTotals.rows[0]?.requests ?? 0);
  const priorCost = Number(priorTotals.rows[0]?.cost ?? 0);
  const priorRequests = Number(priorTotals.rows[0]?.requests ?? 0);
  const currentAvg = currentRequests > 0 ? currentCost / currentRequests : null;
  const priorAvg = priorRequests > 0 ? priorCost / priorRequests : null;

  const modelRows = models.rows.map((row) => ({
    name: row.resolved_model_id,
    cost: Number(row.cost ?? 0),
    calls: Number(row.requests),
  }));
  const totalModelCost = modelRows.reduce((sum, row) => sum + row.cost, 0);

  // Top 5 by cost, percentages against the true total across every provider — not renormalized
  // to just the shown 5, so with 6+ providers the visible rows intentionally sum to under 100%
  // (the rest exist but aren't listed, unlike topModelsBySpend's "Other" bucket below).
  const providerTotalCost = providers.rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
  const providerMix: NamedAmount[] = providers.rows.slice(0, 5).map((row) => ({
    name: row.provider,
    cost: Number(row.cost ?? 0),
    calls: Number(row.requests),
    pct: providerTotalCost > 0 ? (Number(row.cost ?? 0) / providerTotalCost) * 100 : 0,
  }));

  return {
    spend: { current: currentCost, deltaPct: pctDelta(currentCost, priorCost) },
    requests: { current: currentRequests, deltaPct: pctDelta(currentRequests, priorRequests) },
    avgCostPerRequest: {
      current: currentAvg,
      deltaPct: currentAvg !== null && priorAvg !== null ? pctDelta(currentAvg, priorAvg) : null,
    },
    activeModels: Number(activeModels.rows[0]?.count ?? 0),
    dailySpendByProvider: daily.rows.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      provider: row.provider,
      cost: Number(row.cost ?? 0),
    })),
    topModelsBySpend: topNPlusOther(modelRows, 5, totalModelCost),
    providerMix,
  };
}

/**
 * Live-computed rollups scoped to whatever filters the caller passes — the same
 * `LogsFilters` shape the Logs table and Report Builder already use.
 */
export async function getOverviewDetails(
  pool: Pool,
  filters: LogsFilters,
): Promise<OverviewDetails> {
  const { whereSql, params } = buildLogsWhereClause(filters);

  const [totals, byTenant, byApplication, byUser, byProvider, byModel, byApplicationChargeback] =
    await Promise.all([
      pool.query<{ cost: string | null; requests: string; wasted: string | null; tenants: string }>(
        `SELECT COALESCE(SUM(cost), 0) AS cost,
                COUNT(*)::text AS requests,
                COALESCE(SUM(cost) FILTER (WHERE status = 'error'), 0) AS wasted,
                COUNT(DISTINCT tenant_id)::text AS tenants
         FROM requests ${whereSql}`,
        params,
      ),
      pool.query<{ name: string; cost: string | null; calls: string }>(
        `SELECT COALESCE(tenant_id, '${NONE_LABEL}') AS name, COALESCE(SUM(cost), 0) AS cost, COUNT(*)::text AS calls
         FROM requests ${whereSql}
         GROUP BY COALESCE(tenant_id, '${NONE_LABEL}')
         ORDER BY COALESCE(SUM(cost), 0) DESC
         LIMIT 5`,
        params,
      ),
      pool.query<{ name: string; cost: string | null; calls: string }>(
        `SELECT COALESCE(application_id, '${NONE_LABEL}') AS name, COALESCE(SUM(cost), 0) AS cost, COUNT(*)::text AS calls
         FROM requests ${whereSql}
         GROUP BY COALESCE(application_id, '${NONE_LABEL}')
         ORDER BY COALESCE(SUM(cost), 0) DESC
         LIMIT 5`,
        params,
      ),
      pool.query<{ name: string; cost: string | null; calls: string }>(
        `SELECT COALESCE(process_or_user_id, '${NONE_LABEL}') AS name, COALESCE(SUM(cost), 0) AS cost, COUNT(*)::text AS calls
         FROM requests ${whereSql}
         GROUP BY COALESCE(process_or_user_id, '${NONE_LABEL}')
         ORDER BY COALESCE(SUM(cost), 0) DESC
         LIMIT 5`,
        params,
      ),
      pool.query<{ name: string; cost: string | null; calls: string }>(
        `SELECT provider AS name, COALESCE(SUM(cost), 0) AS cost, COUNT(*)::text AS calls
         FROM requests ${whereSql}
         GROUP BY provider
         ORDER BY COALESCE(SUM(cost), 0) DESC`,
        params,
      ),
      pool.query<{ name: string; cost: string | null; calls: string }>(
        `SELECT resolved_model_id AS name, COALESCE(SUM(cost), 0) AS cost, COUNT(*)::text AS calls
         FROM requests ${whereSql}
         GROUP BY resolved_model_id
         ORDER BY COALESCE(SUM(cost), 0) DESC`,
        params,
      ),
      pool.query<{ name: string; cost: string | null; calls: string; wasted: string | null }>(
        `SELECT COALESCE(application_id, '${NONE_LABEL}') AS name,
                COALESCE(SUM(cost), 0) AS cost,
                COUNT(*)::text AS calls,
                COALESCE(SUM(cost) FILTER (WHERE status = 'error'), 0) AS wasted
         FROM requests ${whereSql}
         GROUP BY COALESCE(application_id, '${NONE_LABEL}')
         ORDER BY COALESCE(SUM(cost), 0) DESC`,
        params,
      ),
    ]);

  const totalSpend = Number(totals.rows[0]?.cost ?? 0);
  const totalCalls = Number(totals.rows[0]?.requests ?? 0);
  const wastedSpend = Number(totals.rows[0]?.wasted ?? 0);
  const activeTenants = Number(totals.rows[0]?.tenants ?? 0);

  let spendDeltaPct: number | null = null;
  // Only meaningful against an explicit date range — there's no sensible "prior
  // period" for an unbounded or open-ended query.
  if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate).getTime();
    const end = new Date(filters.endDate).getTime();
    const duration = end - start;
    const priorFilters: LogsFilters = {
      ...filters,
      startDate: new Date(start - duration).toISOString(),
      endDate: new Date(start - 1).toISOString(),
    };
    const { whereSql: priorWhereSql, params: priorParams } = buildLogsWhereClause(priorFilters);
    const priorResult = await pool.query<{ cost: string | null }>(
      `SELECT COALESCE(SUM(cost), 0) AS cost FROM requests ${priorWhereSql}`,
      priorParams,
    );
    spendDeltaPct = pctDelta(totalSpend, Number(priorResult.rows[0]?.cost ?? 0));
  }

  const toNamedAmount = (
    rows: Array<{ name: string; cost: string | null; calls: string }>,
  ): NamedAmount[] =>
    rows.map((row) => ({
      name: row.name,
      cost: Number(row.cost ?? 0),
      calls: Number(row.calls),
      pct: totalSpend > 0 ? (Number(row.cost ?? 0) / totalSpend) * 100 : 0,
    }));

  const modelRows = byModel.rows.map((row) => ({
    name: row.name,
    cost: Number(row.cost ?? 0),
    calls: Number(row.calls),
  }));

  return {
    kpis: {
      totalSpend,
      totalCalls,
      wastedSpend,
      wastedPct: totalSpend > 0 ? (wastedSpend / totalSpend) * 100 : 0,
      activeTenants,
      spendDeltaPct,
    },
    topSpenders: {
      tenant: toNamedAmount(byTenant.rows),
      application: toNamedAmount(byApplication.rows),
      user: toNamedAmount(byUser.rows),
    },
    breakdownByProvider: toNamedAmount(byProvider.rows),
    breakdownByModel: topNPlusOther(modelRows, 5, totalSpend),
    chargebackByApplication: byApplicationChargeback.rows.map((row) => {
      const cost = Number(row.cost ?? 0);
      const wasted = Number(row.wasted ?? 0);
      return {
        name: row.name,
        cost,
        calls: Number(row.calls),
        wasted,
        // This application's own waste rate (wasted / its own spend) — not its share of
        // overall spend, which is already covered by the Spend column's sort order and by
        // Top 5 spenders. Null when the app has no spend at all to compute a rate against.
        wastedPct: cost > 0 ? (wasted / cost) * 100 : null,
      };
    }),
  };
}
