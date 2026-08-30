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
    <div className="min-h-screen bg-slate-50 px-6 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">AiFinOps — Logs</h1>
            <p className="text-sm text-slate-500">Every LLM call the gateway has logged.</p>
          </div>
          <ExportButtons filters={filters} />
        </header>

        <FiltersBar
          filters={filters}
          onChange={handleFiltersChange}
          filterOptions={filterOptions}
        />

        {isError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error instanceof Error ? error.message : 'Failed to load logs.'}
          </div>
        )}

        <LogsTable rows={data?.rows ?? []} isLoading={isLoading} onSelectRow={setSelectedLogId} />

        <Pagination
          page={page}
          totalPages={data?.pagination.totalPages ?? 0}
          totalRows={data?.pagination.totalRows ?? 0}
          onPageChange={setPage}
        />
      </div>

      <RowDetailDrawer logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
    </div>
  );
}
