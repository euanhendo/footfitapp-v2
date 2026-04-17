import { Boot } from './fitting';
import { ScoredBoot } from './fitScore';

export type SortMode = 'score' | 'price-asc' | 'price-desc';

export type BootWidth = Boot['width'];

export type ScoredBootWithTotal = {
  scored: ScoredBoot;
  total: number;
};

export type BootListFilters = {
  widths: Set<BootWidth>;
  brands: Set<string>;
};

export const WIDTH_PROFILE_TIEBREAK_BOOST = 3;

export function applyBootListControls<T extends ScoredBootWithTotal>(
  items: T[],
  filters: BootListFilters,
  sort: SortMode,
  widthProfile?: string,
): T[] {
  const filtered = items.filter(
    (item) =>
      filters.widths.has(item.scored.boot.width) &&
      filters.brands.has(item.scored.boot.brand),
  );

  const sorted = [...filtered];
  if (sort === 'price-asc') {
    sorted.sort((a, b) => a.scored.boot.price - b.scored.boot.price);
  } else if (sort === 'price-desc') {
    sorted.sort((a, b) => b.scored.boot.price - a.scored.boot.price);
  } else {
    const profile = widthProfile ?? '';
    const sortKey = (item: T) =>
      item.total + (profile && item.scored.boot.width === profile ? WIDTH_PROFILE_TIEBREAK_BOOST : 0);
    sorted.sort((a, b) => sortKey(b) - sortKey(a));
  }
  return sorted;
}

export function collectBrands(items: ScoredBootWithTotal[]): string[] {
  const set = new Set<string>();
  for (const item of items) set.add(item.scored.boot.brand);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
