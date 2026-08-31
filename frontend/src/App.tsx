import { useState } from 'react';
import { useLogsFilters, useLogsList } from './api/client';
import type { LogsFilters } from './api/types';
import { ExportButtons } from './components/ExportButtons';
import { FiltersBar } from './components/FiltersBar';
import { LogsTable } from './components/LogsTable';
import { Pagination } from './components/Pagination';
import { RowDetailDrawer } from './components/RowDetailDrawer';

const PAGE_SIZE = 50;

export default function App() {
  const [filters, setFilters] = useState<LogsFilters>({});
  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { data: filterOptions } = useLogsFilters();
  const { data, isLoading, isError, error } = useLogsList(filters, page, PAGE_SIZE);

  const handleFiltersChange = (next: LogsFilters) => {
    setFilters(next);
    setPage(1);
  };

  return (
    <div className="shell">
      <div className="masthead">
        <div className="brand">
          <span className="mark">$</span>
          <h1>AiFinOps</h1>
          <span className="sub">AI SPEND ACCOUNTABILITY &amp; AUDIT</span>
        </div>
        <div className="masthead-right">
          Providers connected: <b>{filterOptions?.providers.length ?? '—'}</b>
          <br />
          Records logged: <b>{data?.pagination.totalRows.toLocaleString() ?? '—'}</b>
        </div>
      </div>

      <div className="view-head">
        <div className="eyebrow">Engineering · Ground Truth</div>
        <h2>Request Log</h2>
        <p>
          Every LLM call the gateway has proxied — provider, model, cost, latency, status, and full
          request/response. Filterable and exportable for audit or debugging. Click any row to
          inspect the full payload.
        </p>
      </div>

      <div className="panel">
        <FiltersBar
          filters={filters}
          onChange={handleFiltersChange}
          filterOptions={filterOptions}
        />
        <div className="filters-foot">
          <button type="button" className="clear-link" onClick={() => handleFiltersChange({})}>
            Clear all filters
          </button>
          <ExportButtons filters={filters} />
        </div>
      </div>

      {isError && (
        <div className="error-banner">
          {error instanceof Error ? error.message : 'Failed to load logs.'}
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <LogsTable rows={data?.rows ?? []} isLoading={isLoading} onSelectRow={setSelectedLogId} />
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalPages={data?.pagination.totalPages ?? 0}
          totalRows={data?.pagination.totalRows ?? 0}
          onPageChange={setPage}
        />
      </div>

      <RowDetailDrawer logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
    </div>
  );
}
