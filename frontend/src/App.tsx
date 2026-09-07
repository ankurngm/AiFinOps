import { useState } from 'react';
import { useLogsFilters, useLogsList } from './api/client';
import type { LogsFilters } from './api/types';
import { ComingSoonPanel } from './components/ComingSoonPanel';
import { DownloadMenu } from './components/DownloadMenu';
import { FilterPills } from './components/FilterPills';
import { FiltersPopoverButton } from './components/FiltersPopoverButton';
import { LogsTable } from './components/LogsTable';
import { Pagination } from './components/Pagination';
import { ReportBuilderView } from './components/ReportBuilderView';
import { RowDetailDrawer } from './components/RowDetailDrawer';
import { useAppUrlState, type TabKey } from './hooks/useAppUrlState';

const PAGE_SIZE = 50;

const TABS: Array<{
  key: TabKey;
  label: string;
  eyebrow: string;
  heading: string;
  description: string;
}> = [
  {
    key: 'overview',
    label: 'Spend Overview',
    eyebrow: 'Finance · At A Glance',
    heading: 'Spend Overview',
    description:
      'Aggregate spend, usage, and trend views across every call the gateway has proxied.',
  },
  {
    key: 'logs',
    label: 'Logs',
    eyebrow: 'Engineering · Ground Truth',
    heading: 'Request Log',
    description:
      'Every LLM call the gateway has proxied — provider, model, cost, latency, status, and full ' +
      'request/response. Filterable and exportable for audit or debugging. Click any row to ' +
      'inspect the full payload.',
  },
  {
    key: 'pivot',
    label: 'Report Builder',
    eyebrow: 'Analytics · Ad Hoc',
    heading: 'Report Builder',
    description: 'Build custom pivot views across cost, tokens, and attribution dimensions.',
  },
];

export default function App() {
  const { tab, setTab, filters, setFilters } = useAppUrlState();
  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { data: filterOptions } = useLogsFilters();
  const { data, isLoading, isError, error } = useLogsList(filters, page, PAGE_SIZE);

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0]!;

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
          <span className="sub">AI GOVERNANCE &amp; SPEND ACCOUNTABILITY</span>
        </div>
        <div className="masthead-right">
          Providers connected: <b>{filterOptions?.providers.length ?? '—'}</b>
          <br />
          Records logged: <b>{data?.pagination.totalRows.toLocaleString() ?? '—'}</b>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <div
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'tab active' : 'tab'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className="view-head">
        <div className="eyebrow">{activeTab.eyebrow}</div>
        <h2>{activeTab.heading}</h2>
        <p>{activeTab.description}</p>
      </div>

      {isError && tab === 'logs' && (
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
            {tab === 'logs' && <DownloadMenu filters={filters} />}
          </div>
        </div>

        {tab === 'overview' && (
          <ComingSoonPanel
            title="Coming soon"
            description="Spend Overview will roll requests up into cost/volume trends, top spenders, and anomaly call-outs — filtered by the same criteria as Logs."
          />
        )}

        {tab === 'logs' && (
          <>
            <LogsTable
              rows={data?.rows ?? []}
              isLoading={isLoading}
              onSelectRow={setSelectedLogId}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalPages={data?.pagination.totalPages ?? 0}
              totalRows={data?.pagination.totalRows ?? 0}
              onPageChange={setPage}
            />
          </>
        )}

        <ReportBuilderView filters={filters} active={tab === 'pivot'} />
      </div>

      <RowDetailDrawer logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
    </div>
  );
}
