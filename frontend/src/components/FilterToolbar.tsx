import type { LogsFilters, LogsFiltersResponse } from '../api/types';
import { DownloadMenu } from './DownloadMenu';
import { FilterPills } from './FilterPills';
import { FiltersPopoverButton } from './FiltersPopoverButton';

interface FilterToolbarProps {
  filters: LogsFilters;
  onChange: (next: LogsFilters) => void;
  filterOptions: LogsFiltersResponse | undefined;
  showDownload?: boolean;
}

export function FilterToolbar({
  filters,
  onChange,
  filterOptions,
  showDownload,
}: FilterToolbarProps) {
  return (
    <div className="toolbar">
      <div className="pills-row">
        <FilterPills filters={filters} onChange={onChange} />
      </div>
      <div className="toolbar-actions">
        <FiltersPopoverButton filters={filters} onChange={onChange} filterOptions={filterOptions} />
        {showDownload && <DownloadMenu filters={filters} />}
      </div>
    </div>
  );
}
