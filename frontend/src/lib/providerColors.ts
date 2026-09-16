// Same fixed colors shown for these four providers elsewhere in the app (see
// DailySpendChart) — kept stable here too rather than reshuffled if config order changes.
const KNOWN_COLORS: Record<string, string> = {
  openrouter: 'var(--series-openrouter)',
  openai: 'var(--series-openai)',
  anthropic: 'var(--series-anthropic)',
  ollama: 'var(--series-ollama)',
};

const EXTRA_COLORS = ['#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const FALLBACK_COLOR = '#9a9690';

/** One color per provider, in a stable order — a 5th+ provider beyond the four known ones
 * gets the next color from EXTRA_COLORS rather than a generated hue. */
export function buildProviderColorMap(providerList: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  let extraIndex = 0;
  for (const provider of providerList) {
    map[provider] = KNOWN_COLORS[provider] ?? EXTRA_COLORS[extraIndex++] ?? FALLBACK_COLOR;
  }
  return map;
}
