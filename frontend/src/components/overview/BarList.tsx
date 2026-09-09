import type { NamedAmount } from '../../api/types';
import { formatUsd } from '../../lib/format';

interface BarListProps {
  items: NamedAmount[];
}

export function BarList({ items }: BarListProps) {
  if (items.length === 0) {
    return <span className="chip-empty">No data for the current filters.</span>;
  }

  const maxCost = Math.max(...items.map((item) => item.cost), Number.EPSILON);

  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="bar-row" key={item.name}>
          <div className="bar-top">
            <span className="name">{item.name}</span>
            <span className="amt">
              <span>{formatUsd(item.cost)}</span>
              <span>{item.pct.toFixed(0)}%</span>
            </span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(item.cost / maxCost) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
