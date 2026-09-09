import { useState } from 'react';
import { useOverviewDetails } from '../../api/client';
import type { LogsFilters } from '../../api/types';
import { formatDelta, formatUsd } from '../../lib/format';
import { ComingSoonPanel } from '../ComingSoonPanel';
import { BarList } from './BarList';
import { ChargebackTable } from './ChargebackTable';
import { KpiTile } from './KpiTile';
import { NamedAmountList } from './NamedAmountList';

interface DetailsPanelProps {
  filters: LogsFilters;
  active: boolean;
}

type SpenderGroup = 'tenant' | 'application' | 'user';

const SPENDER_GROUPS: Array<{ key: SpenderGroup; label: string }> = [
  { key: 'tenant', label: 'Tenant' },
  { key: 'application', label: 'Application' },
  { key: 'user', label: 'User' },
];

export function DetailsPanel({ filters, active }: DetailsPanelProps) {
  const { data, isLoading, isError, error } = useOverviewDetails(filters, active);
  const [spenderGroup, setSpenderGroup] = useState<SpenderGroup>('tenant');

  if (!active) return null;

  if (isError) {
    return (
      <div className="error-banner">
        {error instanceof Error ? error.message : 'Failed to load spend details.'}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <ComingSoonPanel
        title="Loading"
        description="Crunching every request that matches the current filters…"
      />
    );
  }

  const spendDelta = formatDelta(
    data.kpis.spendDeltaPct,
    'vs prior period',
    'set a date range to compare',
  );

  return (
    <>
      <div className="kpi-row">
        <KpiTile
          label="Total spend"
          value={formatUsd(data.kpis.totalSpend)}
          caption={<span className={spendDelta.className}>{spendDelta.label}</span>}
        />
        <KpiTile
          label="Total calls"
          value={data.kpis.totalCalls.toLocaleString()}
          caption={<span className="delta flat">across {data.kpis.activeTenants} tenants</span>}
        />
        <KpiTile
          label="Wasted spend"
          lead
          value={formatUsd(data.kpis.wastedSpend)}
          caption={
            <span className="delta up">{data.kpis.wastedPct.toFixed(0)}% of total spend</span>
          }
        />
        <KpiTile
          label="Active tenants"
          value={String(data.kpis.activeTenants)}
          caption={<span className="delta flat">this window</span>}
        />
      </div>

      <div className="panel">
        <div className="panel-head-row">
          <div className="sec-title" style={{ marginBottom: 0, flex: 'none' }}>
            Top 5 spenders
          </div>
          <div className="seg-toggle">
            {SPENDER_GROUPS.map((group) => (
              <button
                key={group.key}
                type="button"
                className={spenderGroup === group.key ? 'on' : undefined}
                onClick={() => setSpenderGroup(group.key)}
              >
                {group.label}
              </button>
            ))}
          </div>
        </div>
        <BarList items={data.topSpenders[spenderGroup]} />
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="sec-title">Spend breakdown — by provider</div>
          <NamedAmountList items={data.breakdownByProvider} />
        </div>
        <div className="panel">
          <div className="sec-title">Spend breakdown — by model</div>
          <NamedAmountList items={data.breakdownByModel} />
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="sec-title">Chargeback rollup — by application</div>
        <ChargebackTable rows={data.chargebackByApplication} />
      </div>
    </>
  );
}
