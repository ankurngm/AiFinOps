import { useLogsFilters, useOverviewSummary } from '../../api/client';
import { formatDelta, formatUsd } from '../../lib/format';
import { ComingSoonPanel } from '../ComingSoonPanel';
import { DailySpendChart } from './DailySpendChart';
import { KpiTile } from './KpiTile';
import { NamedAmountList } from './NamedAmountList';

export function SummaryPanel() {
  const { data, isLoading, isError, error } = useOverviewSummary();
  const { data: filterOptions } = useLogsFilters();
  const providers = (filterOptions?.providers ?? []).map((id) => ({
    id,
    label: filterOptions?.providerDisplayNames[id] ?? id,
  }));

  if (isError) {
    return (
      <div className="error-banner">
        {error instanceof Error ? error.message : 'Failed to load the spend summary.'}
      </div>
    );
  }

  if (isLoading || !data) {
    return <ComingSoonPanel title="Loading" description="Crunching the last 30 days…" />;
  }

  const spendDelta = formatDelta(data.spend.deltaPct, 'vs prior 30d', 'no prior-period data');
  const requestsDelta = formatDelta(data.requests.deltaPct, 'vs prior 30d', 'no prior-period data');
  const avgCostDelta = formatDelta(
    data.avgCostPerRequest.deltaPct,
    'vs prior 30d',
    'no prior-period data',
  );

  return (
    <>
      <div className="subview-note">
        Standard 30-day summary — a fixed pulse-check, not affected by the filter on Details.
      </div>

      <div className="kpi-row">
        <KpiTile
          label="Spend, 30d"
          value={formatUsd(data.spend.current)}
          caption={<span className={spendDelta.className}>{spendDelta.label}</span>}
        />
        <KpiTile
          label="Requests, 30d"
          value={data.requests.current.toLocaleString()}
          caption={<span className={requestsDelta.className}>{requestsDelta.label}</span>}
        />
        <KpiTile
          label="Avg cost / req"
          value={
            data.avgCostPerRequest.current === null
              ? '—'
              : formatUsd(data.avgCostPerRequest.current)
          }
          caption={<span className={avgCostDelta.className}>{avgCostDelta.label}</span>}
        />
        <KpiTile
          label="Active models"
          value={String(data.activeModels)}
          caption={<span className="delta flat">last 30 days</span>}
        />
      </div>

      <div className="panel">
        <div className="sec-title">Daily spend by provider — last 14 days</div>
        <DailySpendChart rows={data.dailySpendByProvider} providers={providers} />
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="sec-title">Top models by spend</div>
          <NamedAmountList items={data.topModelsBySpend} />
        </div>
        <div className="panel">
          <div className="sec-title">Top 5 provider mix, 30d</div>
          <NamedAmountList items={data.providerMix} />
        </div>
      </div>
    </>
  );
}
