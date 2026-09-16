import { useEffect, useRef, useState } from 'react';
import { ChartAxisLabels } from './ChartAxisLabels';
import { ChartTooltip } from './ChartTooltip';

interface LineSeries {
  id: string;
  color: string;
  values: number[];
}

interface MultiLineChartProps {
  labels: string[];
  series: LineSeries[];
  formatValue: (value: number) => string;
}

const HEIGHT = 120;
const FALLBACK_WIDTH = 1080;

/** One line per series (provider), sharing a y-scale, with a hover readout across all of
 * them at once — replaces a single blended line so providers stay directly comparable. */
export function MultiLineChart({ labels, series, formatValue }: MultiLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured) setWidth(measured);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (labels.length === 0) {
    return <div className="mini-line-chart" ref={containerRef} />;
  }

  const maxVal = Math.max(...series.flatMap((s) => s.values), 0) * 1.15 || 1;
  const yFor = (v: number) => HEIGHT - (v / maxVal) * HEIGHT;
  const xFor = (i: number) =>
    labels.length > 1 ? (i / (labels.length - 1)) * (width - 16) + 8 : width / 2;

  const paths = series.map((s) => ({
    id: s.id,
    color: s.color,
    d: s.values
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`)
      .join(' '),
  }));

  const hoverX = hoverIndex !== null ? xFor(hoverIndex) : null;

  return (
    <>
      <div className="mini-line-chart" ref={containerRef}>
        <svg width={width} height={HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }}>
          <line
            x1={0}
            y1={HEIGHT - 0.5}
            x2={width}
            y2={HEIGHT - 0.5}
            stroke="var(--ink)"
            strokeWidth={1}
          />
          {paths.map((p) => (
            <path key={p.id} d={p.d} fill="none" stroke={p.color} strokeWidth={2} />
          ))}
          {hoverX !== null && (
            <line
              x1={hoverX}
              y1={0}
              x2={hoverX}
              y2={HEIGHT}
              stroke="var(--ink-soft)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}
          {hoverIndex !== null &&
            series.map((s) => (
              <circle
                key={s.id}
                cx={hoverX!}
                cy={yFor(s.values[hoverIndex] ?? 0)}
                r={3.5}
                fill={s.color}
              />
            ))}
        </svg>
        <div
          className="chart-hover-track"
          onMouseLeave={() => setHoverIndex(null)}
          style={{ position: 'absolute', inset: 0, display: 'flex' }}
        >
          {labels.map((_, i) => (
            <div key={i} style={{ flex: 1 }} onMouseEnter={() => setHoverIndex(i)} />
          ))}
        </div>
        {hoverIndex !== null && hoverX !== null && (
          <ChartTooltip
            leftPct={(hoverX / width) * 100}
            title={labels[hoverIndex]!}
            rows={series.map((s) => ({
              id: s.id,
              color: s.color,
              label: s.id,
              value: formatValue(s.values[hoverIndex] ?? 0),
            }))}
          />
        )}
      </div>
      <ChartAxisLabels labels={labels} />
    </>
  );
}
