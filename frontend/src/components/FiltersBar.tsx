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

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-slate-500 focus:outline-none';
const labelClass = 'mb-1 block text-xs font-medium text-slate-500';

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
      className={inputClass}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}

export function FiltersBar({ filters, onChange, filterOptions }: FiltersBarProps) {
  const update = (patch: LogsFilters) => onChange({ ...filters, ...patch });

  const clearAll = () => onChange({});

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className={labelClass}>From</label>
          <input
            type="date"
            className={inputClass}
            value={toDateOnly(filters.startDate)}
            onChange={(e) =>
              update({ startDate: e.target.value ? toStartOfDayUtc(e.target.value) : undefined })
            }
          />
        </div>
        <div>
          <label className={labelClass}>To</label>
          <input
            type="date"
            className={inputClass}
            value={toDateOnly(filters.endDate)}
            onChange={(e) =>
              update({ endDate: e.target.value ? toEndOfDayUtc(e.target.value) : undefined })
            }
          />
        </div>
        <div>
          <label className={labelClass}>Provider</label>
          <select
            className={inputClass}
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
        <div>
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
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
        <div>
          <label className={labelClass}>Model</label>
          <select
            className={inputClass}
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
          <div key={key}>
            <label className={labelClass}>{label}</label>
            <DebouncedTextInput
              value={filters[key] ?? ''}
              placeholder={placeholder}
              onCommit={(value) => update({ [key]: value || undefined })}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={clearAll}
        className="mt-3 text-xs font-medium text-slate-500 hover:text-slate-800"
      >
        Clear all filters
      </button>
    </div>
  );
}
