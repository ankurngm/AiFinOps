import type { LogListRow } from '../api/types';

interface LogsTableProps {
  rows: LogListRow[];
  isLoading: boolean;
  onSelectRow: (id: string) => void;
}

const COLUMNS: Array<{ header: string; render: (row: LogListRow) => React.ReactNode }> = [
  // Rendered exactly as returned by the API (UTC ISO string, same value the
  // CSV/JSONL exports write) — no timezone/locale conversion, so the table
  // and the exported files always show the same timestamp for the same row.
  { header: 'Time (UTC)', render: (row) => row.createdAt },
  { header: 'Provider', render: (row) => row.provider },
  {
    header: 'Model',
    render: (row) => <span className="font-mono text-xs">{row.resolvedModelId}</span>,
  },
  {
    header: 'Status',
    render: (row) => (
      <span
        className={
          row.status === 'success'
            ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
            : 'rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700'
        }
      >
        {row.status}
      </span>
    ),
  },
  { header: 'Tokens', render: (row) => row.totalTokens ?? '—' },
  { header: 'Cost', render: (row) => (row.cost === null ? '—' : `$${row.cost.toFixed(6)}`) },
  { header: 'Latency', render: (row) => `${row.latencyMs} ms` },
  { header: 'Tenant', render: (row) => row.tenantId ?? '—' },
  { header: 'Application', render: (row) => row.applicationId ?? '—' },
  { header: 'Module', render: (row) => row.moduleId ?? '—' },
  { header: 'Region', render: (row) => row.regionId ?? '—' },
  { header: 'Environment', render: (row) => row.environment ?? '—' },
  { header: 'Process / User', render: (row) => row.processOrUserId ?? '—' },
];

export function LogsTable({ rows, isLoading, onSelectRow }: LogsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.header} className="whitespace-nowrap px-3 py-2">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-slate-400">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-slate-400">
                No logs match the current filters.
              </td>
            </tr>
          )}
          {!isLoading &&
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelectRow(row.id)}
                className="cursor-pointer hover:bg-slate-50"
              >
                {COLUMNS.map((column) => (
                  <td key={column.header} className="whitespace-nowrap px-3 py-2">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
