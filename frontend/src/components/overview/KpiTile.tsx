import type { ReactNode } from 'react';

interface KpiTileProps {
  label: string;
  value: string;
  caption: ReactNode;
  lead?: boolean;
}

export function KpiTile({ label, value, caption, lead }: KpiTileProps) {
  return (
    <div className={lead ? 'kpi lead' : 'kpi'}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {caption}
    </div>
  );
}
