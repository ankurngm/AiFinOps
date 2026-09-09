export type RequestStatus = 'success' | 'error';

export interface LogListRow {
  id: string;
  createdAt: string;
  provider: string;
  requestedModel: string;
  resolvedModelId: string;
  status: RequestStatus;
  httpStatusCode: number | null;
  errorMessage: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  cost: number | null;
  upstreamInferenceCost: number | null;
  latencyMs: number;
  regionId: string | null;
  environment: string | null;
  tenantId: string | null;
  applicationId: string | null;
  moduleId: string | null;
  processOrUserId: string | null;
  transactionId: string | null;
  requestId: string | null;
}

export interface LogDetail extends LogListRow {
  requestBody: unknown;
  responseBody: unknown;
}

export interface LogsListResponse {
  rows: LogListRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}

export interface LogsPivotDataResponse {
  rows: LogListRow[];
}

export interface LogsFiltersResponse {
  providers: string[];
  providerDisplayNames: Record<string, string>;
  statuses: RequestStatus[];
  resolvedModelIds: string[];
}

export interface LogsFilters {
  startDate?: string;
  endDate?: string;
  provider?: string;
  resolvedModelId?: string;
  status?: RequestStatus;
  regionId?: string;
  environment?: string;
  tenantId?: string;
  applicationId?: string;
  moduleId?: string;
  processOrUserId?: string;
  transactionId?: string;
}

export interface NamedAmount {
  name: string;
  cost: number;
  calls: number;
  pct: number;
}

export interface OverviewSummaryResponse {
  spend: { current: number; deltaPct: number | null };
  requests: { current: number; deltaPct: number | null };
  avgCostPerRequest: { current: number | null; deltaPct: number | null };
  activeModels: number;
  dailySpendByProvider: Array<{ date: string; provider: string; cost: number }>;
  topModelsBySpend: NamedAmount[];
  providerMix: NamedAmount[];
}

export interface OverviewDetailsResponse {
  kpis: {
    totalSpend: number;
    totalCalls: number;
    wastedSpend: number;
    wastedPct: number;
    activeTenants: number;
    spendDeltaPct: number | null;
  };
  topSpenders: {
    tenant: NamedAmount[];
    application: NamedAmount[];
    user: NamedAmount[];
  };
  breakdownByProvider: NamedAmount[];
  breakdownByModel: NamedAmount[];
  chargebackByApplication: Array<{
    name: string;
    calls: number;
    cost: number;
    wasted: number;
    wastedPct: number | null;
  }>;
}
