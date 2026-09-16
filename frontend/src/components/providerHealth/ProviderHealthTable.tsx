import type { ProviderHealthStat } from '../../api/types';
import { formatUsd } from '../../lib/format';

interface ProviderHealthTableProps {
  stats: ProviderHealthStat[];
}

export function ProviderHealthTable({ stats }: ProviderHealthTableProps) {
  return (
    <div className="table-scroll">
      <table className="rollup-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Requests</th>
            <th>Success rate</th>
            <th>Error rate</th>
            <th>Avg latency</th>
            <th>P95 latency</th>
            <th>Wasted spend</th>
            <th>Wasted tokens</th>
            <th>Cost / request</th>
            <th>Avg tokens / req</th>
            <th>Share of spend</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.provider}>
              <td>{s.provider}</td>
              <td>{s.calls.toLocaleString()}</td>
              <td>{s.successRate.toFixed(1)}%</td>
              <td>{s.errorRate.toFixed(1)}%</td>
              <td>{Math.round(s.avgLatency)} ms</td>
              <td>{Math.round(s.p95Latency)} ms</td>
              <td className="wasted">{formatUsd(s.wastedSpend)}</td>
              <td className="wasted">{Math.round(s.wastedTokens).toLocaleString()}</td>
              <td>{formatUsd(s.costPerCall)}</td>
              <td>{Math.round(s.avgTokensPerCall).toLocaleString()}</td>
              <td>{s.shareOfSpend.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
