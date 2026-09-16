import type { ProviderHealthStat } from '../../api/types';
import { formatUsd } from '../../lib/format';

interface ProviderCardsProps {
  stats: ProviderHealthStat[];
  colors: Record<string, string>;
}

export function ProviderCards({ stats, colors }: ProviderCardsProps) {
  // Every provider in this dataset draws errors from broadly the same conditions, so an
  // absolute error-rate threshold would flag every card red — not a useful signal. Flag a
  // provider only when it's meaningfully worse than its peers' average, which is the
  // actually interesting question ("is one provider having a bad time relative to the others").
  const meanErrorRate = stats.reduce((sum, s) => sum + s.errorRate, 0) / (stats.length || 1);

  return (
    <div className="provider-grid">
      {stats.map((s) => {
        const errColor = s.errorRate > meanErrorRate + 5 ? 'var(--rust)' : 'var(--ledger)';
        return (
          <div className="provider-card" key={s.provider}>
            <div className="provider-card-head">
              <span className="pname">
                <span className="sw" style={{ background: colors[s.provider] }} />
                {s.provider}
              </span>
              <span className="mono-dim">{s.shareOfSpend.toFixed(0)}% of spend</span>
            </div>
            <div className="model-row">
              <span className="mname">Requests</span>
              <span className="mstat">{s.calls.toLocaleString()}</span>
            </div>
            <div className="model-row">
              <span className="mname">Success rate</span>
              <span className="mstat">{s.successRate.toFixed(1)}%</span>
            </div>
            <div className="model-row">
              <span className="mname">Error rate</span>
              <span className="mstat" style={{ color: errColor }}>
                {s.errorRate.toFixed(1)}%
              </span>
            </div>
            <div className="model-row">
              <span className="mname">Avg / P95 latency</span>
              <span className="mstat">
                {Math.round(s.avgLatency)} / {Math.round(s.p95Latency)} ms
              </span>
            </div>
            <div className="model-row">
              <span className="mname">Wasted spend</span>
              <span className="mstat">{formatUsd(s.wastedSpend)}</span>
            </div>
            <div className="model-row">
              <span className="mname">Total spend</span>
              <span className="mstat">{formatUsd(s.totalSpend)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
