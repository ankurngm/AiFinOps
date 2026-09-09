import { useMemo, useState, type ComponentType } from 'react';
// Named import, not default: react-pivottable's CJS build exports
// `{ DraggableAttribute, Dropdown, default: PivotTableUI }`, and because it has more than one
// export, Vite's dev dep pre-bundler re-wraps that whole object as `.default` again (rather than
// unwrapping it, as it does for single-export modules like TableRenderers below) — so a plain
// default import binds a couple of layers away from the actual class, and the exact depth isn't
// guaranteed to match between the dev (esbuild) and prod (Rollup) bundlers. `unwrapDefault` below
// peels `.default` until it finds something callable, which works under both.
import * as PivotTableUIModule from 'react-pivottable/PivotTableUI';
import TableRenderers from 'react-pivottable/TableRenderers';
import type { PivotTableUIProps } from 'react-pivottable';
import type { TableInput } from 'react-pivottable/input';
import 'react-pivottable/pivottable.css';

import { useLogsPivotData } from '../api/client';
import type { LogListRow, LogsFilters } from '../api/types';
import { ComingSoonPanel } from './ComingSoonPanel';

function unwrapDefault<T>(mod: unknown): T {
  let current = mod;
  while (current && typeof current !== 'function' && 'default' in (current as object)) {
    current = (current as { default: unknown }).default;
  }
  return current as T;
}

const PivotTableUI = unwrapDefault<ComponentType<PivotTableUIProps>>(PivotTableUIModule);

interface ReportBuilderViewProps {
  filters: LogsFilters;
  active: boolean;
}

const NONE = '(none)';

/** Flattens a log row into the field names shown in the pivot's drag-and-drop UI. */
function toPivotRecord(row: LogListRow): Record<string, string | number> {
  return {
    Tenant: row.tenantId ?? NONE,
    Application: row.applicationId ?? NONE,
    Module: row.moduleId ?? NONE,
    'Process / User': row.processOrUserId ?? NONE,
    Region: row.regionId ?? NONE,
    Environment: row.environment ?? NONE,
    Provider: row.provider,
    Model: row.resolvedModelId,
    Status: row.status,
    Cost: row.cost ?? 0,
    Tokens: row.totalTokens ?? 0,
  };
}

// Restricted to renderers that need no extra charting dependency — Table and
// Table Heatmap ship with react-pivottable itself.
const RENDERERS = {
  Table: TableRenderers.Table,
  'Table Heatmap': TableRenderers['Table Heatmap'],
};

// Only the pivot *configuration* fields — deliberately not `data`, `renderers`, or `onChange`.
// react-pivottable's onChange fires with its entire current props object patched with whatever
// changed (see PivotTableUI.js: `onChange(update(this.props, command))`), snapshot `data` and
// all — so persisting that whole object back into state would freeze the pivot on whatever
// dataset was current the first time the user touched the UI, ignoring every later refetch.
type PivotConfig = Pick<
  PivotTableUIProps,
  | 'rows'
  | 'cols'
  | 'vals'
  | 'aggregatorName'
  | 'rendererName'
  | 'valueFilter'
  | 'sorters'
  | 'rowOrder'
  | 'colOrder'
>;

const DEFAULT_PIVOT_STATE: PivotConfig = {
  rows: ['Tenant'],
  cols: ['Provider'],
  vals: ['Cost'],
  aggregatorName: 'Sum',
  rendererName: 'Table',
};

export function ReportBuilderView({ filters, active }: ReportBuilderViewProps) {
  const { data, isLoading, isError, error } = useLogsPivotData(filters, active);
  const [pivotState, setPivotState] = useState<PivotConfig>(DEFAULT_PIVOT_STATE);

  // react-pivottable's own type declares `data` as string-valued records; Cost/Tokens are
  // numeric so its built-in Sum/Average aggregators have something to add — the declaration
  // just doesn't model that, so the cast below is a types-only gap, not a runtime one.
  const records = useMemo(() => (data?.rows ?? []).map(toPivotRecord), [data]);

  if (!active) return null;

  if (isError) {
    return (
      <div className="error-banner">
        {error instanceof Error ? error.message : 'Failed to load report data.'}
      </div>
    );
  }

  if (isLoading) {
    return (
      <ComingSoonPanel
        title="Loading"
        description="Fetching every request that matches the current filters…"
      />
    );
  }

  if (records.length === 0) {
    return (
      <ComingSoonPanel
        title="No data"
        description="No logged requests match the current filters."
      />
    );
  }

  return (
    <div className="pivot-wrap">
      <div className="pivot-caption">
        Drag a field into Rows or Columns, pick an aggregator, and choose Table or Table Heatmap —
        computed over every request matching the filters above, not just the current page.
      </div>
      <div className="pivot-scroll">
        <PivotTableUI
          data={records as unknown as TableInput}
          renderers={RENDERERS}
          {...pivotState}
          onChange={(next) =>
            setPivotState({
              rows: next.rows,
              cols: next.cols,
              vals: next.vals,
              aggregatorName: next.aggregatorName,
              rendererName: next.rendererName,
              valueFilter: next.valueFilter,
              sorters: next.sorters,
              rowOrder: next.rowOrder,
              colOrder: next.colOrder,
            })
          }
        />
      </div>
    </div>
  );
}
