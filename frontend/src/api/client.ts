import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { LogDetail, LogsFilters, LogsFiltersResponse, LogsListResponse } from './types';

function toQueryParams(
  filters: LogsFilters,
  extra?: Record<string, string | number>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, String(value));
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, String(value));
    }
  }
  return params;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String(body.error)
        : response.statusText;
    throw new Error(message || `request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function useLogsList(filters: LogsFilters, page: number, pageSize: number) {
  const params = toQueryParams(filters, { page, pageSize });
  return useQuery({
    queryKey: ['logs', params.toString()],
    queryFn: () => fetchJson<LogsListResponse>(`/api/logs?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
}

export function useLogsFilters() {
  return useQuery({
    queryKey: ['logs-filters'],
    queryFn: () => fetchJson<LogsFiltersResponse>('/api/logs/filters'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogDetail(id: string | null) {
  return useQuery({
    queryKey: ['log', id],
    queryFn: () => fetchJson<LogDetail>(`/api/logs/${id}`),
    enabled: id !== null,
  });
}

export function buildExportUrl(kind: 'csv' | 'jsonl', filters: LogsFilters): string {
  const params = toQueryParams(filters);
  return `/api/logs/export.${kind}?${params.toString()}`;
}
