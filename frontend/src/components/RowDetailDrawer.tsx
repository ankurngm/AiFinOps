import { useLogDetail } from '../api/client';

interface RowDetailDrawerProps {
  logId: string | null;
  onClose: () => void;
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mm">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}

export function RowDetailDrawer({ logId, onClose }: RowDetailDrawerProps) {
  const { data: log, isLoading } = useLogDetail(logId);

  if (logId === null) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-box" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="dt">Request Detail</div>
            <div
              className="mono-dim"
              style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 2 }}
            >
              #{logId}
              {log?.requestId ? ` · ${log.requestId}` : ''}
            </div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {isLoading && <div className="drawer-body mono-dim">Loading…</div>}

        {log && (
          <>
            <div className="drawer-meta">
              <MetaCell label="Time (UTC)" value={log.createdAt} />
              <MetaCell
                label="Status"
                value={`${log.httpStatusCode ?? '—'} ${log.status.toUpperCase()}`}
              />
              <MetaCell
                label="Provider / Model"
                value={`${log.provider} / ${log.resolvedModelId}`}
              />
              <MetaCell label="Latency" value={`${log.latencyMs} ms`} />
              <MetaCell label="Cost" value={log.cost === null ? '—' : `$${log.cost.toFixed(6)}`} />
              <MetaCell
                label="Tokens (prompt/completion/total)"
                value={`${log.promptTokens ?? '—'} / ${log.completionTokens ?? '—'} / ${log.totalTokens ?? '—'}`}
              />
              <MetaCell
                label="Tenant / Application / Module"
                value={`${log.tenantId ?? '—'} / ${log.applicationId ?? '—'} / ${log.moduleId ?? '—'}`}
              />
              <MetaCell
                label="Region / Environment"
                value={`${log.regionId ?? '—'} / ${log.environment ?? '—'}`}
              />
              <MetaCell label="Process / User" value={log.processOrUserId ?? '—'} />
              <MetaCell label="Transaction" value={log.transactionId ?? '—'} />
            </div>

            {log.errorMessage && <div className="drawer-error">{log.errorMessage}</div>}

            <div className="drawer-body">
              <div className="sec-title">Request body</div>
              <div className="code-block">
                {log.requestBody === null ? '—' : JSON.stringify(log.requestBody, null, 2)}
              </div>

              <div className="sec-title">Response body</div>
              <div className="code-block">
                {log.responseBody === null ? '—' : JSON.stringify(log.responseBody, null, 2)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
