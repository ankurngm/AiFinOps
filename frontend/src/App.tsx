import { useState } from 'react';
import { useLogsFilters, useLogsList } from './api/client';
import type { LogsFilters } from './api/types';
import { DownloadMenu } from './components/DownloadMenu';
import { FilterPills } from './components/FilterPills';
import { FiltersPopoverButton } from './components/FiltersPopoverButton';
import { LogsTable } from './components/LogsTable';
import { Pagination } from './components/Pagination';
import { RowDetailDrawer } from './components/RowDetailDrawer';

const PAGE_SIZE = 50;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function last24HoursFilter(): LogsFilters {
  const now = new Date();
  return {
    startDate: new Date(now.getTime() - ONE_DAY_MS).toISOString(),
    endDate: now.toISOString(),
  };
}

export default function App() {
  const [filters, setFilters] = useState<LogsFilters>(last24HoursFilter);
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

      {isError && (
        <div className="error-banner">
          {error instanceof Error ? error.message : 'Failed to load logs.'}
        </div>
      )}

      <div className="panel">
        <div className="toolbar">
          <div className="pills-row">
            <FilterPills filters={filters} onChange={handleFiltersChange} />
          </div>
          <div className="toolbar-actions">
            <FiltersPopoverButton
              filters={filters}
              onChange={handleFiltersChange}
              filterOptions={filterOptions}
            />
            <DownloadMenu filters={filters} />
          </div>
        </div>

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
