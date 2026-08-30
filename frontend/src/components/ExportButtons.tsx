import { buildExportUrl } from '../api/client';
import type { LogsFilters } from '../api/types';

interface ExportButtonsProps {
  filters: LogsFilters;
}

const linkClass =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ' +
  'hover:bg-slate-50';

export function ExportButtons({ filters }: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <a className={linkClass} href={buildExportUrl('csv', filters)}>
        Export CSV
      </a>
      <a
        className={linkClass}
        href={buildExportUrl('jsonl', filters)}
        title="Full request/response, one JSON object per line"
      >
        Export full (JSONL)
      </a>
    </div>
  );
}
