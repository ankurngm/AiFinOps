import type { LogsFilters } from '../api/types';

interface FilterPillsProps {
  filters: LogsFilters;
  onChange: (next: LogsFilters) => void;
}

const FIELD_LABELS: Partial<Record<keyof LogsFilters, string>> = {
  provider: 'Provider',
  status: 'Status',
  resolvedModelId: 'Model',
  regionId: 'Region',
  environment: 'Environment',
  tenantId: 'Tenant',
  applicationId: 'Application',
  moduleId: 'Module',
  processOrUserId: 'Process / User',
  transactionId: 'Transaction',
};

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function FilterPills({ filters, onChange }: FilterPillsProps) {
  const remove = (patch: LogsFilters) => onChange({ ...filters, ...patch });

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (filters.startDate || filters.endDate) {
    const label =
      filters.startDate && filters.endDate
        ? `Date range: ${dateOnly(filters.startDate)} → ${dateOnly(filters.endDate)}`
        : filters.startDate
          ? `From: ${dateOnly(filters.startDate)}`
          : `To: ${dateOnly(filters.endDate as string)}`;
    chips.push({
      key: 'date',
      label,
      onRemove: () => remove({ startDate: undefined, endDate: undefined }),
    });
  }

  for (const [key, label] of Object.entries(FIELD_LABELS) as Array<[keyof LogsFilters, string]>) {
    const value = filters[key];
    if (value) {
      chips.push({
        key,
        label: `${label}: ${value}`,
        onRemove: () => remove({ [key]: undefined }),
      });
    }
  }

  if (chips.length === 0) {
    return <span className="chip-empty">No filters — showing all requests</span>;
  }

  return (
    <>
      {chips.map((chip) => (
        <span className="filter-chip" key={chip.key}>
          {chip.label}
          <button type="button" onClick={chip.onRemove} aria-label={`Remove filter: ${chip.label}`}>
            ×
          </button>
        </span>
      ))}
    </>
  );
}
