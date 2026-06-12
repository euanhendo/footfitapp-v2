import { useColorScheme } from 'react-native';

// FootFit palette, light and dark. Dark mode is the SNKRS treatment: pure
// black, white type, photography untinted. Components keep inline styles and
// pull colours from this hook — no styling library, no shared components.
export type Palette = {
  dark: boolean;
  bg: string;
  card: string;
  cardBorder: string;
  chipBorder: string;
  panel: string;
  text: string;
  muted: string;
  faint: string;
  hairline: string;
  // Primary CTA inverts in dark mode (white pill, black label).
  ctaBg: string;
  ctaText: string;
  // Hero/profile card: near-black in both modes, bordered when on black.
  heroBg: string;
  heroBorder: string;
};

const LIGHT: Palette = {
  dark: false,
  bg: '#f9f9f9',
  card: '#fff',
  cardBorder: '#ebebeb',
  chipBorder: '#d5d5d5',
  panel: '#f5f5f5',
  text: '#111',
  muted: '#666',
  faint: '#999',
  hairline: '#e8e8e8',
  ctaBg: '#111',
  ctaText: '#fff',
  heroBg: '#111',
  heroBorder: '#111',
};

const DARK: Palette = {
  dark: true,
  bg: '#000',
  card: '#141414',
  cardBorder: '#262626',
  chipBorder: '#3a3a3a',
  panel: '#1d1d1d',
  text: '#fff',
  muted: '#a3a3a3',
  faint: '#8a8a8a',
  hairline: '#262626',
  ctaBg: '#fff',
  ctaText: '#111',
  heroBg: '#161616',
  heroBorder: '#2a2a2a',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
