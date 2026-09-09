import { useUrlSearchParams } from './useUrlSearchParams';
import type { LogsFilters } from '../api/types';

export type TabKey = 'overview' | 'logs' | 'pivot';

const DEFAULT_TAB: TabKey = 'overview';
const TAB_KEYS: TabKey[] = ['overview', 'logs', 'pivot'];

const FILTER_KEYS: Array<keyof LogsFilters> = [
  'startDate',
  'endDate',
  'provider',
  'resolvedModelId',
  'status',
  'regionId',
  'environment',
  'tenantId',
  'applicationId',
  'moduleId',
  'processOrUserId',
  'transactionId',
];

function parseTab(params: URLSearchParams): TabKey {
  const raw = params.get('tab');
  return (TAB_KEYS as string[]).includes(raw ?? '') ? (raw as TabKey) : DEFAULT_TAB;
}

function parseFilters(params: URLSearchParams): LogsFilters {
  const filters: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }
  return filters as LogsFilters;
}

/**
 * Tab + filter state, persisted to the URL query string instead of React
 * state — so switching tabs or changing a filter is shareable/bookmarkable
 * and participates in browser back/forward.
 */
export function useAppUrlState() {
  const [params, updateParams] = useUrlSearchParams();

  const tab = parseTab(params);
  const filters = parseFilters(params);

  const setTab = (next: TabKey) => {
    updateParams((p) => {
      if (next === DEFAULT_TAB) p.delete('tab');
      else p.set('tab', next);
    });
  };

  const setFilters = (next: LogsFilters) => {
    updateParams((p) => {
      for (const key of FILTER_KEYS) {
        const value = next[key];
        if (value) p.set(key, value);
        else p.delete(key);
      }
    });
  };

  return { tab, setTab, filters, setFilters };
}
