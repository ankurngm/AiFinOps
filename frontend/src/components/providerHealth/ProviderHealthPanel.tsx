import { useState } from 'react';
import { useProviderHealthSnapshot, useProviderHealthTrends } from '../../api/client';
import { buildProviderColorMap } from '../../lib/providerColors';
import { ComingSoonPanel } from '../ComingSoonPanel';
import { ProviderCards } from './ProviderCards';
import { ProviderCompare } from './ProviderCompare';
import { ProviderHealthTable } from './ProviderHealthTable';
import { ProviderTrends } from './ProviderTrends';

const WINDOW_OPTIONS = [30, 60, 90, 180, 365];

export function ProviderHealthPanel() {
  const [windowDays, setWindowDays] = useState(90);
  // Empty string / null stand for "not yet chosen by the user" — the effective value falls
  // back to the first (or first two) providers once the list loads, computed at render time
  // below rather than seeded via an effect.
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<Set<string> | null>(null);

  const snapshot = useProviderHealthSnapshot(windowDays);
  const trends = useProviderHealthTrends(windowDays);

  const providerList = snapshot.data?.stats.map((s) => s.provider) ?? [];

  if (snapshot.isError || trends.isError) {
    const error = snapshot.error ?? trends.error;
    return (
      <div className="error-banner">
        {error instanceof Error ? error.message : 'Failed to load provider health.'}
      </div>
    );
  }

  if (!snapshot.data || !trends.data) {
    return <ComingSoonPanel title="Loading" description="Rolling up provider-level stats…" />;
  }

  const { stats } = snapshot.data;
  const { buckets, granularity, providers } = trends.data;
  const colors = buildProviderColorMap(providers);

  return (
    <>
      <div className="panel">
        <div className="panel-head-row">
          <div className="sec-title" style={{ marginBottom: 0, flex: 'none' }}>
            Snapshot window
          </div>
          <div className="seg-toggle">
            {WINDOW_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                className={windowDays === days ? 'on' : undefined}
                onClick={() => setWindowDays(days)}
              >
                Last {days}d
              </button>
            ))}
          </div>
        </div>
        <div className="annot" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
          Applies to the scorecards, table, comparison, and trends below.
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <ProviderCards stats={stats} colors={colors} />
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="sec-title">Provider comparison — last {windowDays} days</div>
        <ProviderHealthTable stats={stats} />
        <div className="annot">
          "Wasted" = requests that reached the provider and consumed tokens (and cost) before
          failing — rate-limited or upstream errors, not requests rejected up front for a bad
          model/key (those carry no cost).
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="sec-title">Compare two providers — last {windowDays} days</div>
        <ProviderCompare
          stats={stats}
          providerList={providerList}
          compareA={compareA || providerList[0] || ''}
          compareB={compareB || providerList[1] || providerList[0] || ''}
          onChangeA={setCompareA}
          onChangeB={setCompareB}
        />
      </div>

      <ProviderTrends
        buckets={buckets}
        granularity={granularity}
        windowDays={windowDays}
        providerList={providers}
        colors={colors}
        selected={selectedProviders ?? new Set(providers)}
        onChangeSelected={setSelectedProviders}
      />
    </>
  );
}
