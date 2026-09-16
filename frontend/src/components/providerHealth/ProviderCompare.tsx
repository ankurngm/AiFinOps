import type { ProviderHealthStat } from '../../api/types';
import { formatUsd } from '../../lib/format';

interface ProviderCompareProps {
  stats: ProviderHealthStat[];
  providerList: string[];
  compareA: string;
  compareB: string;
  onChangeA: (provider: string) => void;
  onChangeB: (provider: string) => void;
}

interface Metric {
  label: string;
  a: number;
  b: number;
  fmt: (v: number) => string;
  // undefined means "just a fact, no good/bad direction"
  lowerIsBetter?: boolean;
}

export function ProviderCompare({
  stats,
  providerList,
  compareA,
  compareB,
  onChangeA,
  onChangeB,
}: ProviderCompareProps) {
  const a = stats.find((s) => s.provider === compareA);
  const b = stats.find((s) => s.provider === compareB);

  const metrics: Metric[] | null =
    a && b
      ? [
          { label: 'Requests', a: a.calls, b: b.calls, fmt: (v) => v.toLocaleString() },
          {
            label: 'Success rate',
            a: a.successRate,
            b: b.successRate,
            fmt: (v) => `${v.toFixed(1)}%`,
            lowerIsBetter: false,
          },
          {
            label: 'Error rate',
            a: a.errorRate,
            b: b.errorRate,
            fmt: (v) => `${v.toFixed(1)}%`,
            lowerIsBetter: true,
          },
          {
            label: 'Avg latency',
            a: a.avgLatency,
            b: b.avgLatency,
            fmt: (v) => `${Math.round(v)} ms`,
            lowerIsBetter: true,
          },
          {
            label: 'P95 latency',
            a: a.p95Latency,
            b: b.p95Latency,
            fmt: (v) => `${Math.round(v)} ms`,
            lowerIsBetter: true,
          },
          {
            label: 'Wasted spend',
            a: a.wastedSpend,
            b: b.wastedSpend,
            fmt: (v) => formatUsd(v),
            lowerIsBetter: true,
          },
          {
            label: 'Wasted tokens',
            a: a.wastedTokens,
            b: b.wastedTokens,
            fmt: (v) => Math.round(v).toLocaleString(),
            lowerIsBetter: true,
          },
          {
            label: 'Cost / request',
            a: a.costPerCall,
            b: b.costPerCall,
            fmt: (v) => formatUsd(v),
            lowerIsBetter: true,
          },
          {
            label: 'Avg tokens / req',
            a: a.avgTokensPerCall,
            b: b.avgTokensPerCall,
            fmt: (v) => Math.round(v).toLocaleString(),
          },
          {
            label: 'Share of spend',
            a: a.shareOfSpend,
            b: b.shareOfSpend,
            fmt: (v) => `${v.toFixed(1)}%`,
          },
        ]
      : null;

  return (
    <>
      <div
        className="filters"
        style={{ gridTemplateColumns: 'minmax(160px, 200px) minmax(160px, 200px)' }}
      >
        <div className="field">
          <label>Provider A</label>
          <select value={compareA} onChange={(e) => onChangeA(e.target.value)}>
            {providerList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Provider B</label>
          <select value={compareB} onChange={(e) => onChangeB(e.target.value)}>
            {providerList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="table-scroll" style={{ marginTop: 14 }}>
        <table className="rollup-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>{compareA}</th>
              <th>{compareB}</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {metrics?.map((m) => {
              const diff = m.a - m.b;
              let diffColor = 'var(--ink-soft)';
              if (m.lowerIsBetter !== undefined && diff !== 0) {
                diffColor = (m.lowerIsBetter ? diff < 0 : diff > 0)
                  ? 'var(--ledger)'
                  : 'var(--rust)';
              }
              // Format the magnitude and prepend the sign ourselves — formatUsd puts "$"
              // before a negative number's own "-" (e.g. "$-0.64"), which reads worse than
              // "-$0.64".
              const diffText = diff === 0 ? '—' : `${diff > 0 ? '+' : '-'}${m.fmt(Math.abs(diff))}`;
              return (
                <tr key={m.label}>
                  <td>{m.label}</td>
                  <td>{m.fmt(m.a)}</td>
                  <td>{m.fmt(m.b)}</td>
                  <td style={{ color: diffColor }}>{diffText}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
