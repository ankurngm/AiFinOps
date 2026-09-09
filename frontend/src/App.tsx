import { useState } from 'react';
import { useLogsFilters, useLogsList } from './api/client';
import type { LogsFilters } from './api/types';
import { FilterToolbar } from './components/FilterToolbar';
import { LogsTable } from './components/LogsTable';
import { DetailsPanel } from './components/overview/DetailsPanel';
import { SummaryPanel } from './components/overview/SummaryPanel';
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
      'Summary is the standard 30-day pulse-check everyone glances at first. Details is where ' +
      'you drill into who is responsible, what was wasted, and how it breaks down — scoped to ' +
      'the filter below.',
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

type OverviewSubTab = 'summary' | 'details';

const OVERVIEW_SUBTABS: Array<{ key: OverviewSubTab; label: string }> = [
  { key: 'summary', label: 'Summary' },
  { key: 'details', label: 'Details' },
];

export default function App() {
  const { tab, setTab, filters, setFilters } = useAppUrlState();
  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [overviewSubTab, setOverviewSubTab] = useState<OverviewSubTab>('summary');

  const { data: filterOptions } = useLogsFilters();
  const { data, isLoading, isError, error } = useLogsList(filters, page, PAGE_SIZE);

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0]!;
  // Filters only ever apply to Overview's Details and to Logs/Report Builder — Summary is a
  // fixed 30-day snapshot, so the filter bar has nothing to do there and stays hidden.
  const showToolbar = tab !== 'overview' || overviewSubTab === 'details';

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

      {tab === 'overview' && (
        <div className="subtabs" role="tablist">
          {OVERVIEW_SUBTABS.map((sub) => (
            <div
              key={sub.key}
              role="tab"
              aria-selected={overviewSubTab === sub.key}
              className={overviewSubTab === sub.key ? 'subtab active' : 'subtab'}
              onClick={() => setOverviewSubTab(sub.key)}
            >
              {sub.label}
            </div>
          ))}
        </div>
      )}

      {isError && tab === 'logs' && (
        <div className="error-banner">
          {error instanceof Error ? error.message : 'Failed to load logs.'}
        </div>
      )}

      {showToolbar &&
        (tab === 'overview' ? (
          <FilterToolbar
            filters={filters}
            onChange={handleFiltersChange}
            filterOptions={filterOptions}
          />
        ) : (
          <div className="panel">
            <FilterToolbar
              filters={filters}
              onChange={handleFiltersChange}
              filterOptions={filterOptions}
              showDownload={tab === 'logs'}
            />

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
        ))}

      {tab === 'overview' && overviewSubTab === 'summary' && <SummaryPanel />}
      {tab === 'overview' && overviewSubTab === 'details' && (
        <DetailsPanel filters={filters} active />
      )}

      <RowDetailDrawer logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
    </div>
  );
}
