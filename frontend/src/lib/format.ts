/** Matches the Logs table's own cost formatting (six decimals) below one cent,
 * since typical per-request costs here are fractions of a cent. */
export function formatUsd(value: number): string {
  if (value !== 0 && Math.abs(value) < 0.01) {
    return `$${value.toFixed(6)}`;
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  });
}

export interface DeltaCaption {
  label: string;
  className: 'delta up' | 'delta down' | 'delta flat';
}

/** "up" is styled as the attention color and "down" as the reassuring one — appropriate for
 * cost/spend deltas, where more is the thing worth noticing. */
export function formatDelta(
  deltaPct: number | null,
  suffix: string,
  fallback: string,
): DeltaCaption {
  if (deltaPct === null) return { label: fallback, className: 'delta flat' };
  const direction = deltaPct >= 0 ? 'up' : 'down';
  const arrow = deltaPct >= 0 ? '↑' : '↓';
  return {
    label: `${arrow} ${Math.abs(deltaPct).toFixed(0)}% ${suffix}`,
    className: `delta ${direction}`,
  };
}
