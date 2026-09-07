import { useMemo } from 'react';
import { formatUsd } from '../../lib/format';

interface DailySpendChartProps {
  rows: Array<{ date: string; provider: string; cost: number }>;
  /** Every provider the gateway is configured for — read from config, not hardcoded, so a
   * newly-added provider shows up here without a code change. */
  providers: Array<{ id: string; label: string }>;
}

// Colors already shown to users for these four — kept stable rather than reshuffled if the
// provider list's order in config ever changes.
const KNOWN_COLORS: Record<string, string> = {
  openrouter: 'var(--series-openrouter)',
  openai: 'var(--series-openai)',
  anthropic: 'var(--series-anthropic)',
  ollama: 'var(--series-ollama)',
};

// Remaining slots of the same validated 8-hue categorical order (see dataviz skill's
// palette.md) — assigned in order to any provider beyond the four above.
const EXTRA_COLORS = ['#e87ba4', '#008300', '#4a3aa7', '#e34948'];

const MAX_SERIES = Object.keys(KNOWN_COLORS).length + EXTRA_COLORS.length;
const OTHER_COLOR = '#9a9690';
const OTHER_ID = '__other__';

interface Series {
  id: string;
  label: string;
  color: string;
}

/** Assigns each configured provider a validated, stable color — the first `MAX_SERIES`
 * individually, and anything past that folded into one "Other providers" series, per the
 * dataviz skill's rule that a 9th+ category never gets a generated hue. */
function buildSeries(providers: Array<{ id: string; label: string }>): Series[] {
  const series: Series[] = [];
  let extraIndex = 0;

  for (const provider of providers) {
    if (series.length >= MAX_SERIES) break;
    const knownColor = KNOWN_COLORS[provider.id];
    const color = knownColor ?? EXTRA_COLORS[extraIndex++] ?? OTHER_COLOR;
    series.push({ id: provider.id, label: provider.label, color });
  }

  if (providers.length > series.length) {
    series.push({ id: OTHER_ID, label: 'Other providers', color: OTHER_COLOR });
  }

  return series;
}

function lastNDates(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i),
    );
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function DailySpendChart({ rows, providers }: DailySpendChartProps) {
  const dates = useMemo(() => lastNDates(14), []);
  const series = useMemo(() => buildSeries(providers), [providers]);
  const foldedIds = useMemo(() => {
    const kept = new Set(series.map((s) => s.id));
    return new Set(providers.map((p) => p.id).filter((id) => !kept.has(id)));
  }, [series, providers]);

  const byDate = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const seriesId = foldedIds.has(row.provider) ? OTHER_ID : row.provider;
      if (!map.has(row.date)) map.set(row.date, new Map());
      const perProvider = map.get(row.date);
      if (!perProvider) continue;
      perProvider.set(seriesId, (perProvider.get(seriesId) ?? 0) + row.cost);
    }
    return map;
  }, [rows, foldedIds]);

  const maxTotal = useMemo(() => {
    let max = 0;
    for (const date of dates) {
      const perProvider = byDate.get(date);
      const total = series.reduce((sum, s) => sum + (perProvider?.get(s.id) ?? 0), 0);
      if (total > max) max = total;
    }
    return max || 1;
  }, [dates, byDate, series]);

  return (
    <>
      <div className="chart-wrap">
        {dates.map((date) => {
          const perProvider = byDate.get(date);
          const present = series.filter((s) => (perProvider?.get(s.id) ?? 0) > 0);
          const topSeries = present[present.length - 1];
          return (
            <div className="chart-bar-group" key={date}>
              {present.map((s) => {
                const cost = perProvider?.get(s.id) ?? 0;
                return (
                  <div
                    key={s.id}
                    className={s.id === topSeries?.id ? 'cbar cbar-top' : 'cbar'}
                    style={{ height: `${(cost / maxTotal) * 100}%`, background: s.color }}
                    title={`${s.label}, ${date}: ${formatUsd(cost)}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="chart-labels">
        {dates.map((date) => (
          <span key={date}>{formatDayLabel(date)}</span>
        ))}
      </div>
      <div className="legend">
        {series.map((s) => (
          <div className="li" key={s.id}>
            <span className="sw" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </>
  );
}
