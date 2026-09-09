import { formatUsd } from '../../lib/format';

interface ChargebackRow {
  name: string;
  calls: number;
  cost: number;
  wasted: number;
  wastedPct: number | null;
}

interface ChargebackTableProps {
  rows: ChargebackRow[];
}

export function ChargebackTable({ rows }: ChargebackTableProps) {
  return (
    <div className="table-scroll">
      <table className="rollup-table">
        <thead>
          <tr>
            <th>Application</th>
            <th>Calls</th>
            <th>Spend</th>
            <th>Wasted $</th>
            <th>Wasted %</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr className="empty-row">
              <td colSpan={5}>No data for the current filters.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.calls.toLocaleString()}</td>
              <td>{formatUsd(row.cost)}</td>
              <td className="wasted">{formatUsd(row.wasted)}</td>
              <td>{row.wastedPct === null ? '—' : `${row.wastedPct.toFixed(1)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
