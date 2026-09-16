import { useEffect, useRef, useState } from 'react';
import type { ProviderHealthTrendBucket, ProviderHealthTrendGranularity } from '../../api/types';
import { formatUsd } from '../../lib/format';
import { ChartAxisLabels } from './ChartAxisLabels';
import { ChartTooltip } from './ChartTooltip';
import { MultiLineChart } from './MultiLineChart';

interface ProviderTrendsProps {
  buckets: ProviderHealthTrendBucket[];
  granularity: ProviderHealthTrendGranularity;
  windowDays: number;
  providerList: string[];
  colors: Record<string, string>;
  selected: Set<string>;
  onChangeSelected: (next: Set<string>) => void;
}

const UNIT_NOUN: Record<ProviderHealthTrendGranularity, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
};

function providerSelectorLabel(selected: Set<string>, total: number): string {
  if (selected.size === total) return 'All providers';
  if (selected.size === 0) return 'No providers';
  if (selected.size === 1) return [...selected][0]!;
  return `${selected.size} providers`;
}

export function ProviderTrends({
  buckets,
  granularity,
  windowDays,
  providerList,
  colors,
  selected,
  onChangeSelected,
}: ProviderTrendsProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [hoverBucketIndex, setHoverBucketIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    const onClick = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [popoverOpen]);

  const selectedProviders = providerList.filter((p) => selected.has(p));
  const unitNoun = UNIT_NOUN[granularity];
  const labels = buckets.map((b) => b.label);

  const toggleAll = (checked: boolean) => {
    onChangeSelected(checked ? new Set(providerList) : new Set());
  };

  const toggleOne = (provider: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(provider);
    else next.delete(provider);
    onChangeSelected(next);
  };

  const maxVol =
    Math.max(
      ...buckets.map((b) =>
        selectedProviders.reduce((sum, p) => sum + (b.providers[p]?.count ?? 0), 0),
      ),
      0,
    ) || 1;

  const completed = buckets.filter((b) => !b.isCurrent);
  let volumeAnnot: string;
  if (selectedProviders.length === 0) {
    volumeAnnot = 'No providers selected.';
  } else if (completed.length >= 2) {
    const last = completed[completed.length - 1]!;
    const prev = completed[completed.length - 2]!;
    const lastTotal = selectedProviders.reduce((s, p) => s + (last.providers[p]?.count ?? 0), 0);
    const prevTotal = selectedProviders.reduce((s, p) => s + (prev.providers[p]?.count ?? 0), 0);
    const growth = prevTotal > 0 ? ((lastTotal - prevTotal) / prevTotal) * 100 : 0;
    volumeAnnot =
      `Total requests (selected providers), last completed ${unitNoun} vs. the one before: ` +
      `${growth >= 0 ? '+' : ''}${growth.toFixed(0)}% (the current ${unitNoun} is still in ` +
      `progress, so it's excluded from this comparison).`;
  } else {
    volumeAnnot = 'Not enough completed history yet for a period-over-period comparison.';
  }

  // One line per provider (not blended) so they stay directly comparable on each chart.
  const errorRateSeries = selectedProviders.map((p) => ({
    id: p,
    color: colors[p]!,
    values: buckets.map((b) => {
      const count = b.providers[p]?.count ?? 0;
      return count ? ((b.providers[p]?.errors ?? 0) / count) * 100 : 0;
    }),
  }));
  const wastedSpendSeries = selectedProviders.map((p) => ({
    id: p,
    color: colors[p]!,
    values: buckets.map((b) => b.providers[p]?.wastedSpend ?? 0),
  }));
  const avgLatencySeries = selectedProviders.map((p) => ({
    id: p,
    color: colors[p]!,
    values: buckets.map((b) => {
      const count = b.providers[p]?.count ?? 0;
      return count ? (b.providers[p]?.latencySum ?? 0) / count : 0;
    }),
  }));

  const hoverBucket = hoverBucketIndex !== null ? buckets[hoverBucketIndex] : null;

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head-row">
        <div className="sec-title" style={{ marginBottom: 0, flex: 'none' }}>
          Trends — last {windowDays} days
        </div>
        <div className="popover-anchor" ref={anchorRef}>
          <button
            type="button"
            className={popoverOpen ? 'toolbar-btn open' : 'toolbar-btn'}
            onClick={() => setPopoverOpen((v) => !v)}
          >
            {providerSelectorLabel(selected, providerList.length)} ▾
          </button>
          {popoverOpen && (
            <div className="popover" style={{ padding: 12, width: 220, right: 0 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  borderBottom: '1px dashed var(--line)',
                  paddingBottom: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.size === providerList.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                All providers
              </label>
              <div>
                {providerList.map((p) => (
                  <label
                    key={p}
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      textTransform: 'capitalize',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p)}
                      onChange={(e) => toggleOne(p, e.target.checked)}
                      style={{ marginRight: 6 }}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="annot" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
        Bucketed by {unitNoun} over the selected window. Volume is stacked by provider (only the
        ones selected); error rate, wasted spend, and latency below each get one line per selected
        provider. Hover any chart for the exact numbers per {unitNoun}.
      </div>

      <div className="sec-title" style={{ marginTop: 16 }}>
        Request volume
      </div>
      <div className="chart-wrap" onMouseLeave={() => setHoverBucketIndex(null)}>
        {buckets.map((b, i) => (
          <div className="chart-bar-group" key={b.key} onMouseEnter={() => setHoverBucketIndex(i)}>
            {selectedProviders.map((p) => {
              const v = b.providers[p]?.count ?? 0;
              const h = (v / maxVol) * 100;
              if (h <= 0) return null;
              return (
                <div key={p} className="cbar" style={{ height: `${h}%`, background: colors[p] }} />
              );
            })}
          </div>
        ))}
        {hoverBucket && hoverBucketIndex !== null && (
          <ChartTooltip
            leftPct={((hoverBucketIndex + 0.5) / buckets.length) * 100}
            title={hoverBucket.label}
            rows={selectedProviders.map((p) => ({
              id: p,
              color: colors[p]!,
              label: p,
              value: (hoverBucket.providers[p]?.count ?? 0).toLocaleString(),
            }))}
          />
        )}
      </div>
      <ChartAxisLabels labels={labels} />
      <div className="legend">
        {selectedProviders.map((p) => (
          <div className="li" key={p}>
            <span className="sw" style={{ background: colors[p] }} />
            {p}
          </div>
        ))}
      </div>
      <div className="annot">{volumeAnnot}</div>

      <div className="sec-title" style={{ marginTop: 20 }}>
        Error rate, by provider
      </div>
      <MultiLineChart
        labels={labels}
        series={errorRateSeries}
        formatValue={(v) => `${v.toFixed(1)}%`}
      />

      <div className="sec-title" style={{ marginTop: 20 }}>
        Wasted spend, by provider
      </div>
      <MultiLineChart
        labels={labels}
        series={wastedSpendSeries}
        formatValue={(v) => formatUsd(v)}
      />

      <div className="sec-title" style={{ marginTop: 20 }}>
        Avg latency, by provider
      </div>
      <MultiLineChart
        labels={labels}
        series={avgLatencySeries}
        formatValue={(v) => `${Math.round(v)} ms`}
      />
    </div>
  );
}
