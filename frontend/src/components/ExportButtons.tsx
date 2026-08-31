import { buildExportUrl } from '../api/client';
import type { LogsFilters } from '../api/types';

interface ExportButtonsProps {
  filters: LogsFilters;
}

export function ExportButtons({ filters }: ExportButtonsProps) {
  return (
    <div className="btn-row">
      <a className="btn" href={buildExportUrl('csv', filters)}>
        ↓ Export CSV
      </a>
      <a
        className="btn"
        href={buildExportUrl('jsonl', filters)}
        title="Full request/response, one JSON object per line"
      >
        ↓ Export full (JSONL)
      </a>
    </div>
  );
}
