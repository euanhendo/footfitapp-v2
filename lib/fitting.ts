export const UK_SIZE_TO_LENGTH_MM: Record<string, number> = {
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

export type WidthProfile = 'narrow' | 'standard' | 'wide';
export type SizeSystem = 'UK' | 'EU';

const WIDTH_RATIOS: Record<WidthProfile, number> = {
  narrow: 0.36,
  standard: 0.375,
  wide: 0.39,
};

export function estimateWidthFromLength(lengthMm: number, widthProfile: WidthProfile): number {
  if (!lengthMm) return 0;
  return Math.round(lengthMm * WIDTH_RATIOS[widthProfile]);
}

export function getEstimatedLengthMm(sizeSystem: SizeSystem, sizeValue: string): number {
  const cleanValue = String(sizeValue).trim();
  if (sizeSystem === 'UK') return UK_SIZE_TO_LENGTH_MM[cleanValue] ?? 0;
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
};

export type SockEntry = { brand: string; thickness: number; sport: string };

export function filterBoots(
  boots: Boot[],
  adjustedLength: number,
  adjustedWidth: number,
  sport: string,
  gender: string,
): Boot[] {
  return boots.filter((boot) => {
    const sportMatch = boot.sport === sport;
    const genderMatch = boot.gender === gender || boot.gender === 'unisex';
    const lengthMatch = adjustedLength >= boot.minLength && adjustedLength <= boot.maxLength;
    const widthMatch = adjustedWidth >= boot.minWidth && adjustedWidth <= boot.maxWidth;
    return sportMatch && genderMatch && lengthMatch && widthMatch;
  });
}

export function getSocksForSport(
  sockDb: Record<string, SockEntry>,
  sport: string,
): { key: string; brand: string; thickness: number }[] {
  return Object.entries(sockDb)
    .filter(([, entry]) => entry.sport === sport)
    .map(([key, entry]) => ({ key, brand: entry.brand, thickness: entry.thickness }));
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
