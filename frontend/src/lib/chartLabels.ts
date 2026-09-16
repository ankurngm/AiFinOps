/** Indices to actually draw text at when an axis has more buckets than fit legibly — e.g. 90
 * daily buckets. Spaced by a stride so roughly `maxVisible` labels show, always including the
 * last bucket so the axis doesn't appear to end early. */
export function visibleLabelIndices(count: number, maxVisible = 14): number[] {
  if (count === 0) return [];
  if (count <= maxVisible) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil(count / maxVisible);
  const indices: number[] = [];
  for (let i = 0; i < count; i += step) indices.push(i);
  if (indices[indices.length - 1] !== count - 1) indices.push(count - 1);
  return indices;
}
