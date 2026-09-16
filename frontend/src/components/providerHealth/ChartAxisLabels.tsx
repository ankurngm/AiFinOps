import { visibleLabelIndices } from '../../lib/chartLabels';

interface ChartAxisLabelsProps {
  labels: string[];
}

function anchorTransform(pct: number): string {
  if (pct < 8) return 'translateX(0)';
  if (pct > 92) return 'translateX(-100%)';
  return 'translateX(-50%)';
}

/** X-axis labels positioned by percentage rather than one-per-column flex — a wide axis (e.g.
 * 90 daily buckets) only has room to draw a fraction of them, and giving every bucket an equal
 * flex share would squeeze the few visible labels into an unreadable sliver. Positioning
 * absolutely lets a shown label take its natural width regardless of how many buckets exist. */
export function ChartAxisLabels({ labels }: ChartAxisLabelsProps) {
  const indices = visibleLabelIndices(labels.length);
  return (
    <div className="chart-axis-labels">
      {indices.map((i) => {
        const pct = labels.length > 1 ? (i / (labels.length - 1)) * 100 : 50;
        return (
          <span key={i} style={{ left: `${pct}%`, transform: anchorTransform(pct) }}>
            {labels[i]}
          </span>
        );
      })}
    </div>
  );
}
