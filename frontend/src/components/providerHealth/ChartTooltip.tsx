interface ChartTooltipRow {
  id: string;
  color: string;
  label: string;
  value: string;
}

interface ChartTooltipProps {
  /** Horizontal position as a percentage of the chart's width (0-100). */
  leftPct: number;
  title: string;
  rows: ChartTooltipRow[];
}

/** Anchors left/center/right depending on how close to the chart's edge the hovered point is,
 * so the box never spills past the chart's own bounds — a plain "always centered" tooltip
 * clips off-screen for the first/last column. */
function anchorTransform(leftPct: number): string {
  if (leftPct < 10) return 'translateX(0)';
  if (leftPct > 90) return 'translateX(-100%)';
  return 'translateX(-50%)';
}

export function ChartTooltip({ leftPct, title, rows }: ChartTooltipProps) {
  return (
    <div
      className="chart-tooltip"
      style={{ left: `${leftPct}%`, transform: anchorTransform(leftPct) }}
    >
      <div className="chart-tooltip-title">{title}</div>
      {rows.map((row) => (
        <div className="chart-tooltip-row" key={row.id}>
          <span className="sw" style={{ background: row.color }} />
          <span className="chart-tooltip-label">{row.label}</span>
          <span className="chart-tooltip-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
