import type { NamedAmount } from '../../api/types';
import { formatUsd } from '../../lib/format';

interface NamedAmountListProps {
  items: NamedAmount[];
}

export function NamedAmountList({ items }: NamedAmountListProps) {
  if (items.length === 0) {
    return <span className="chip-empty">No data for the current filters.</span>;
  }

  return (
    <>
      {items.map((item) => (
        <div className="model-row" key={item.name}>
          <span className="mname">{item.name}</span>
          <span className="mstat">
            <span>{formatUsd(item.cost)}</span>
            <span className="mono-dim">{item.pct.toFixed(0)}%</span>
          </span>
        </div>
      ))}
    </>
  );
}
