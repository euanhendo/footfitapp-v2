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

export const US_SIZE_TO_LENGTH_MM: Record<string, number> = {
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

const WIDTH_RATIOS: Record<WidthProfile, number> = {
  narrow: 0.33,
  standard: 0.36,
  wide: 0.385,
};

export function estimateWidthFromLength(lengthMm: number, widthProfile: WidthProfile): number {
  if (!lengthMm) return 0;
  return Math.round(lengthMm * WIDTH_RATIOS[widthProfile]);
}

export function getEstimatedLengthMm(sizeSystem: SizeSystem, sizeValue: string): number {
  const cleanValue = String(sizeValue).trim();
  if (sizeSystem === 'UK') return UK_SIZE_TO_LENGTH_MM[cleanValue] ?? 0;
  if (sizeSystem === 'US') return US_SIZE_TO_LENGTH_MM[cleanValue] ?? 0;
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
