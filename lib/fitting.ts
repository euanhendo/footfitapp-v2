import { computePersonalOffsetMm } from './fitCalibration';
import { OwnedShoe } from './ownedShoes';

// Junior sizes extend the same continuous UK scale below adult 5 in 4 mm
// half-steps. Child sizes (10–13.5) restart the numbering, so they carry a
// K suffix to avoid colliding with adult 10–13.5.
export const UK_SIZE_TO_LENGTH_MM: Record<string, number> = {
  '10K': 176,
  '10.5K': 180,
  '11K': 184,
  '11.5K': 188,
  '12K': 192,
  '12.5K': 196,
  '13K': 200,
  '13.5K': 204,
  '1': 208,
  '1.5': 212,
  '2': 216,
  '2.5': 220,
  '3': 224,
  '3.5': 228,
  '4': 232,
  '4.5': 236,
  '5': 240,
  '5.5': 244,
  '6': 248,
  '6.5': 252,
  '7': 257,
  '7.5': 261,
  '8': 265,
  '8.5': 269,
  '9': 274,
  '9.5': 278,
  '10': 282,
  '10.5': 286,
  '11': 291,
  '11.5': 295,
  '12': 299,
};

export const EU_SIZE_TO_LENGTH_MM: Record<string, number> = {
  '28': 173,
  '29': 180,
  '30': 186,
  '31': 193,
  '32': 199,
  '33': 206,
  '34': 212,
  '35': 219,
  '36': 225,
  '37': 232,
  '38': 238,
  '39': 245,
  '40': 252,
  '41': 258,
  '42': 265,
  '43': 272,
  '44': 278,
  '45': 285,
  '46': 292,
  '47': 298,
};

// US kids: C = child, Y = youth (US runs a half size above UK juniors).
export const US_SIZE_TO_LENGTH_MM: Record<string, number> = {
  '10.5C': 176,
  '11C': 180,
  '11.5C': 184,
  '12C': 188,
  '12.5C': 192,
  '13C': 196,
  '13.5C': 200,
  '1Y': 204,
  '1.5Y': 208,
  '2Y': 212,
  '2.5Y': 216,
  '3Y': 220,
  '3.5Y': 224,
  '4Y': 228,
  '4.5Y': 232,
  '5Y': 236,
  '6': 240,
  '6.5': 244,
  '7': 248,
  '7.5': 252,
  '8': 257,
  '8.5': 261,
  '9': 265,
  '9.5': 269,
  '10': 274,
  '10.5': 278,
  '11': 282,
  '11.5': 286,
  '12': 291,
  '12.5': 295,
  '13': 299,
};

export type WidthProfile = 'narrow' | 'standard' | 'wide';
export type SizeSystem = 'UK' | 'EU' | 'US';

// Ratios are deliberately offset from the narrow-boot width locus (~0.33 of
// length over the catalogue) so that a narrow-profile user's estimated width
// does not collapse onto the centre of every narrow boot's range. Without the
// offset, widthScore rounded near 100 for every narrow user, hiding genuine
// mismatches — see Issue #1.
const WIDTH_RATIOS: Record<WidthProfile, number> = {
  narrow: 0.345,
  standard: 0.36,
  wide: 0.38,
};

export function estimateWidthFromLength(lengthMm: number, widthProfile: WidthProfile): number {
  if (!lengthMm) return 0;
  return Math.round(lengthMm * WIDTH_RATIOS[widthProfile]);
}

// `junior` reinterprets ambiguous numeric sizes on the kids scale: UK/US
// 10–13.5 become child sizes, US 1–5 become youth sizes. Explicit suffixes
// ("13K", "3Y", "11.5C") work in any mode; EU numbering is already unique.
export function getEstimatedLengthMm(
  sizeSystem: SizeSystem,
  sizeValue: string,
  junior: boolean = false,
): number {
  const cleanValue = String(sizeValue).trim().toUpperCase();
  if (sizeSystem === 'UK') {
    if (junior) {
      const n = Number(cleanValue);
      if (Number.isFinite(n) && n >= 10 && n <= 13.5) {
        return UK_SIZE_TO_LENGTH_MM[`${cleanValue}K`] ?? 0;
      }
    }
    return UK_SIZE_TO_LENGTH_MM[cleanValue] ?? 0;
  }
  if (sizeSystem === 'US') {
    if (junior) {
      const n = Number(cleanValue);
      if (Number.isFinite(n)) {
        if (n >= 10 && n <= 13.5) return US_SIZE_TO_LENGTH_MM[`${cleanValue}C`] ?? 0;
        if (n >= 1 && n <= 5) return US_SIZE_TO_LENGTH_MM[`${cleanValue}Y`] ?? 0;
      }
    }
    return US_SIZE_TO_LENGTH_MM[cleanValue] ?? 0;
  }
  return EU_SIZE_TO_LENGTH_MM[cleanValue] ?? 0;
}

export type Boot = {
  brand: string;
  model: string;
  gender: string;
  sport: string;
  width: string;
  minLength: number;
  maxLength: number;
  minWidth: number;
  maxWidth: number;
  price: number;
  notes: string;
  purchaseUrl: string;
  imageUrl: string;
  // mm offset vs. universal size tables. 0 = true-to-size. Negative = runs
  // small (size up in recommendations). Positive = runs large.
  sizeOffset?: number;
  // Surface categories the model is sold in (football): FG, SG, AG, TF, IC.
  surfaces?: string[];
};

export type SizeRecommendation = {
  uk: string;
  eu: string;
  us: string;
  headroomMm: number;
  borderlineTight: boolean;
};

function pickClosestSize(
  table: Record<string, number>,
  targetMm: number,
): { key: string; nominal: number; nextNominal: number } {
  const entries = Object.entries(table).sort((a, b) => a[1] - b[1]);
  let bestIdx = 0;
  let bestDist = Math.abs(entries[0][1] - targetMm);
  for (let i = 1; i < entries.length; i++) {
    const dist = Math.abs(entries[i][1] - targetMm);
    if (dist < bestDist) {
      bestIdx = i;
      bestDist = dist;
    } else if (dist === bestDist && entries[i][1] > entries[bestIdx][1]) {
      // Tie: prefer the higher nominal so the shoe errs on the roomy side.
      bestIdx = i;
    }
  }
  const [key, nominal] = entries[bestIdx];
  const nextEntry = entries[bestIdx + 1];
  const nextNominal = nextEntry ? nextEntry[1] : nominal;
  return { key, nominal, nextNominal };
}

export function effectiveSizeOffset(boot: Boot, ownedShoes: OwnedShoe[]): number {
  return (boot.sizeOffset ?? 0) + computePersonalOffsetMm(ownedShoes, boot.brand);
}

export function recommendSize(
  adjustedLengthMm: number,
  sizeOffset: number = 0,
): SizeRecommendation {
  const effectiveMm = adjustedLengthMm - sizeOffset;
  const uk = pickClosestSize(UK_SIZE_TO_LENGTH_MM, effectiveMm);
  const eu = pickClosestSize(EU_SIZE_TO_LENGTH_MM, effectiveMm);
  const us = pickClosestSize(US_SIZE_TO_LENGTH_MM, effectiveMm);
  const headroomMm = Math.max(0, uk.nextNominal - effectiveMm);
  const borderlineTight = effectiveMm > uk.nominal && headroomMm < 2;
  return {
    uk: uk.key,
    eu: eu.key,
    us: us.key,
    headroomMm,
    borderlineTight,
  };
}

export type SockEntry = {
  brand: string;
  name: string;
  thickness: number;
  sport: string;
  imageUrl: string;
};

export type SockOption = {
  key: string;
  brand: string;
  name: string;
  thickness: number;
  imageUrl: string;
};

export type SockBrandSection = { brand: string; data: SockOption[] };

export function filterBoots(
  boots: Boot[],
  adjustedLength: number,
  adjustedWidth: number,
  sport: string,
  gender: string,
): Boot[] {
  return boots.filter((boot) => {
    const sportMatch = boot.sport === sport;
    const genderMatch = gender === 'unisex' || boot.gender === gender || boot.gender === 'unisex';
    const lengthMatch = adjustedLength >= boot.minLength && adjustedLength <= boot.maxLength;
    const widthMatch = adjustedWidth >= boot.minWidth && adjustedWidth <= boot.maxWidth;
    return sportMatch && genderMatch && lengthMatch && widthMatch;
  });
}

export function getSocksForSport(
  sockDb: Record<string, SockEntry>,
  sport: string,
): SockOption[] {
  return Object.entries(sockDb)
    .filter(([, entry]) => entry.sport === sport)
    .map(([key, entry]) => ({
      key,
      brand: entry.brand,
      name: entry.name,
      thickness: entry.thickness,
      imageUrl: entry.imageUrl,
    }));
}

export function groupSocksByBrand(options: SockOption[]): SockBrandSection[] {
  const sections: SockBrandSection[] = [];
  const byBrand = new Map<string, SockOption[]>();
  for (const option of options) {
    const existing = byBrand.get(option.brand);
    if (existing) {
      existing.push(option);
    } else {
      const data: SockOption[] = [option];
      byBrand.set(option.brand, data);
      sections.push({ brand: option.brand, data });
    }
  }
  return sections;
}

export function applySocketAdjustment(
  footLength: number,
  footWidth: number,
  sockThickness: number,
): { adjustedLength: number; adjustedWidth: number } {
  return {
    adjustedLength: footLength + sockThickness,
    adjustedWidth: footWidth + sockThickness,
  };
}
