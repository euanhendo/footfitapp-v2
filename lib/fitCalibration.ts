import { OwnedShoe } from './ownedShoes';

const RATING_DELTA_MM: Record<NonNullable<OwnedShoe['fitRating']>, number> = {
  tight: -1,
  true: 0,
  loose: 1,
};

const CLAMP_MM = 2;

export function computePersonalOffsetMm(ownedShoes: OwnedShoe[], brand: string): number {
  const rated = ownedShoes.filter((s) => s.brand === brand && s.fitRating !== undefined);
  if (rated.length === 0) return 0;
  const sum = rated.reduce((acc, s) => acc + RATING_DELTA_MM[s.fitRating!], 0);
  const mean = sum / rated.length;
  return Math.max(-CLAMP_MM, Math.min(CLAMP_MM, mean));
}
