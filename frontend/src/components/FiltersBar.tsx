import { useEffect, useState } from 'react';
import type { LogsFilters, LogsFiltersResponse } from '../api/types';

interface FiltersBarProps {
  filters: LogsFilters;
  onChange: (next: LogsFilters) => void;
  filterOptions: LogsFiltersResponse | undefined;
}

const TEXT_SEARCH_FIELDS: Array<{ key: keyof LogsFilters; label: string; placeholder: string }> = [
  { key: 'regionId', label: 'Region', placeholder: 'e.g. us-east-1' },
  { key: 'environment', label: 'Environment', placeholder: 'e.g. production' },
  { key: 'tenantId', label: 'Tenant', placeholder: 'e.g. tenant_apple' },
  { key: 'applicationId', label: 'Application', placeholder: 'e.g. e-commerce-api' },
  { key: 'moduleId', label: 'Module', placeholder: 'e.g. billing' },
  { key: 'processOrUserId', label: 'Process / User', placeholder: 'e.g. usr_98234' },
  { key: 'transactionId', label: 'Transaction', placeholder: 'e.g. tx_abc123' },
];

function toStartOfDayUtc(dateOnly: string): string {
  return `${dateOnly}T00:00:00.000Z`;
}

function toEndOfDayUtc(dateOnly: string): string {
  return `${dateOnly}T23:59:59.999Z`;
}

function toDateOnly(isoTimestamp: string | undefined): string {
  return isoTimestamp ? isoTimestamp.slice(0, 10) : '';
}

/** Free-text field with its own local state, propagated to the parent (and
 * so into the API request) only after the user pauses typing — avoids
 * firing a request on every keystroke for a Splunk-style substring search. */
function DebouncedTextInput({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder: string;
}) {
  const [prevValue, setPrevValue] = useState(value);
  const [draft, setDraft] = useState(value);

  // Reset the draft when the committed value changes for a reason other
  // than this component's own debounce (e.g. "Clear all filters"). Updating
  // state during render, rather than in an effect, is the documented React
  // pattern for this — see https://react.dev/learn/you-might-not-need-an-effect.
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) onCommit(draft);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <input
      type="text"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}

export function FiltersBar({ filters, onChange, filterOptions }: FiltersBarProps) {
  const update = (patch: LogsFilters) => onChange({ ...filters, ...patch });

  return (
    <div className="filters">
      <div className="field">
        <label>From</label>
        <input
          type="date"
          value={toDateOnly(filters.startDate)}
          onChange={(e) =>
            update({ startDate: e.target.value ? toStartOfDayUtc(e.target.value) : undefined })
          }
        />
      </div>
      <div className="field">
        <label>To</label>
        <input
          type="date"
          value={toDateOnly(filters.endDate)}
          onChange={(e) =>
            update({ endDate: e.target.value ? toEndOfDayUtc(e.target.value) : undefined })
          }
        />
      </div>
      <div className="field">
        <label>Provider</label>
        <select
          value={filters.provider ?? ''}
          onChange={(e) => update({ provider: e.target.value || undefined })}
        >
          <option value="">All</option>
          {filterOptions?.providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Status</label>
        <select
          value={filters.status ?? ''}
          onChange={(e) =>
            update({ status: (e.target.value || undefined) as LogsFilters['status'] })
          }
        >
          <option value="">All</option>
          {filterOptions?.statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Model</label>
        <select
          value={filters.resolvedModelId ?? ''}
          onChange={(e) => update({ resolvedModelId: e.target.value || undefined })}
        >
          <option value="">All</option>
          {filterOptions?.resolvedModelIds.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {TEXT_SEARCH_FIELDS.map(({ key, label, placeholder }) => (
        <div className="field" key={key}>
          <label>{label}</label>
          <DebouncedTextInput
            value={filters[key] ?? ''}
            placeholder={placeholder}
            onCommit={(value) => update({ [key]: value || undefined })}
          />
        </div>
      ))}
    </div>
  );
}
