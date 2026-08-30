import { useLogDetail } from '../api/client';

interface RowDetailDrawerProps {
  logId: string | null;
  onClose: () => void;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
      <pre className="max-h-96 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
        {value === null || value === undefined ? '—' : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function RowDetailDrawer({ logId, onClose }: RowDetailDrawerProps) {
  const { data: log, isLoading } = useLogDetail(logId);

  if (logId === null) return null;

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Log #{logId}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

        {log && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Time (UTC)</dt>
                <dd>{log.createdAt}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd>{log.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Provider / Model</dt>
                <dd className="font-mono text-xs">
                  {log.provider} / {log.resolvedModelId}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Latency</dt>
                <dd>{log.latencyMs} ms</dd>
              </div>
              <div>
                <dt className="text-slate-500">Cost</dt>
                <dd>{log.cost === null ? '—' : `$${log.cost.toFixed(6)}`}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Tokens (prompt/completion/total)</dt>
                <dd>
                  {log.promptTokens ?? '—'} / {log.completionTokens ?? '—'} /{' '}
                  {log.totalTokens ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Tenant / Application / Module</dt>
                <dd>
                  {log.tenantId ?? '—'} / {log.applicationId ?? '—'} / {log.moduleId ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Region / Environment</dt>
                <dd>
                  {log.regionId ?? '—'} / {log.environment ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Process / User</dt>
                <dd>{log.processOrUserId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Transaction</dt>
                <dd>{log.transactionId ?? '—'}</dd>
              </div>
              {log.errorMessage && (
                <div className="col-span-2">
                  <dt className="text-slate-500">Error</dt>
                  <dd className="text-rose-600">{log.errorMessage}</dd>
                </div>
              )}
            </dl>

            <JsonBlock label="Request body" value={log.requestBody} />
            <JsonBlock label="Response body" value={log.responseBody} />
          </div>
        )}
      </div>
    </div>
  );
}
