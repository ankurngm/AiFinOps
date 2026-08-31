import type { LogListRow } from '../api/types';

interface LogsTableProps {
  rows: LogListRow[];
  isLoading: boolean;
  onSelectRow: (id: string) => void;
}

function StatusPill({ row }: { row: LogListRow }) {
  const code = row.httpStatusCode ?? '—';
  return (
    <span className={row.status === 'success' ? 'pill ok' : 'pill err'}>
      {code} {row.status.toUpperCase()}
    </span>
  );
}

const COLUMNS: Array<{ header: string; render: (row: LogListRow) => React.ReactNode }> = [
  // Rendered exactly as returned by the API (UTC ISO string, same value the
  // CSV/JSONL exports write) — no timezone/locale conversion, so the table
  // and the exported files always show the same timestamp for the same row.
  { header: 'Time (UTC)', render: (row) => <span className="mono-dim">{row.createdAt}</span> },
  { header: 'Provider', render: (row) => row.provider },
  { header: 'Model', render: (row) => row.resolvedModelId },
  { header: 'Status', render: (row) => <StatusPill row={row} /> },
  { header: 'Tokens', render: (row) => <span className="mono-dim">{row.totalTokens ?? '—'}</span> },
  { header: 'Cost', render: (row) => (row.cost === null ? '—' : `$${row.cost.toFixed(6)}`) },
  { header: 'Latency', render: (row) => <span className="mono-dim">{row.latencyMs} ms</span> },
  { header: 'Tenant', render: (row) => row.tenantId ?? '—' },
  { header: 'Application', render: (row) => row.applicationId ?? '—' },
  { header: 'Module', render: (row) => row.moduleId ?? '—' },
  { header: 'Region', render: (row) => row.regionId ?? '—' },
  { header: 'Environment', render: (row) => row.environment ?? '—' },
  { header: 'Process / User', render: (row) => row.processOrUserId ?? '—' },
];

export function LogsTable({ rows, isLoading, onSelectRow }: LogsTableProps) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.header}>{column.header}</th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr className="empty-row">
              <td colSpan={COLUMNS.length + 1}>Loading…</td>
            </tr>
          )}
          {!isLoading && rows.length === 0 && (
            <tr className="empty-row">
              <td colSpan={COLUMNS.length + 1}>No logs match the current filters.</td>
            </tr>
          )}
          {!isLoading &&
            rows.map((row) => (
              <tr key={row.id}>
                {COLUMNS.map((column) => (
                  <td key={column.header}>{column.render(row)}</td>
                ))}
                <td className="row-actions">
                  <button type="button" className="view-btn" onClick={() => onSelectRow(row.id)}>
                    view
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
