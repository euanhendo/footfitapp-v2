import { Boot } from './fitting';
import { ScoredBoot } from './fitScore';

export type SortMode = 'score' | 'price-asc' | 'price-desc';

export type BootWidth = Boot['width'];

export type ScoredBootWithTotal = {
  scored: ScoredBoot;
  total: number;
};

// Standard football surface categories; null = all surfaces.
export type SurfaceFilter = 'FG' | 'SG' | 'AG' | 'TF' | 'IC';

export type BootListFilters = {
  widths: Set<BootWidth>;
  brands: Set<string>;
  surface?: SurfaceFilter | null;
};

export function applyBootListControls<T extends ScoredBootWithTotal>(
  items: T[],
  filters: BootListFilters,
  sort: SortMode,
  widthProfile?: string,
): T[] {
  const filtered = items.filter(
    (item) =>
      filters.widths.has(item.scored.boot.width) &&
      filters.brands.has(item.scored.boot.brand) &&
      (!filters.surface || (item.scored.boot.surfaces ?? []).includes(filters.surface)),
  );

  const sorted = [...filtered];
  if (sort === 'price-asc') {
    sorted.sort((a, b) => a.scored.boot.price - b.scored.boot.price);
  } else if (sort === 'price-desc') {
    sorted.sort((a, b) => b.scored.boot.price - a.scored.boot.price);
  } else {
    // Best displayed score always leads — the ordering must never contradict
    // the % badge the user sees. Width-profile match and price only separate
    // genuinely equal scores.
    const profile = widthProfile ?? '';
    const widthMatch = (item: T) =>
      profile && item.scored.boot.width === profile ? 1 : 0;
    sorted.sort(
      (a, b) =>
        b.total - a.total ||
        widthMatch(b) - widthMatch(a) ||
        a.scored.boot.price - b.scored.boot.price,
    );
  }
  return sorted;
}

export function collectBrands(items: ScoredBootWithTotal[]): string[] {
  const set = new Set<string>();
  for (const item of items) set.add(item.scored.boot.brand);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
