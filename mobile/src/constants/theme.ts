import { Platform } from 'react-native';

import { useAppColorScheme } from '@/lib/theme-preference';

/** On the website, screens are see-through (an animated background sits behind them) and
 * surfaces are frosted glass; the phone app keeps solid colours. */
const web = Platform.OS === 'web';

export const Accent = '#00BFA6';

export const Colors = {
  light: {
    text: '#0B0D0E',
    textSecondary: '#5B6266',
    background: '#F6F8F8',
    page: web ? 'transparent' : '#F6F8F8',
    surface: web ? 'rgba(255,255,255,0.72)' : '#FFFFFF',
    surfaceAlt: web ? 'rgba(232,238,238,0.78)' : '#EEF2F2',
    border: '#DDE3E3',
    accent: Accent,
    accentSoft: '#D6F5F0',
    onAccent: '#00261F',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    dangerSoft: '#FDE8E8',
    muted: '#9CA3AF',
  },
  dark: {
    text: '#F2F5F5',
    textSecondary: '#9FA8AB',
    background: '#0B0E0F',
    page: web ? 'transparent' : '#0B0E0F',
    surface: web ? 'rgba(22,27,29,0.62)' : '#161B1D',
    surfaceAlt: web ? 'rgba(31,38,41,0.72)' : '#1F2629',
    border: '#2A3236',
    accent: Accent,
    accentSoft: '#0E3A34',
    onAccent: '#00261F',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    dangerSoft: '#3A1717',
    muted: '#6B7280',
  },
} as const;

export type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** Charger pin colours: green Working, amber Busy, red Broken, grey Unknown. */
export const StatusColors = {
  WORKING: '#22C55E',
  BUSY: '#F59E0B',
  BROKEN: '#EF4444',
  UNKNOWN: '#9CA3AF',
} as const;

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const Radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

/** Minimum touch target (Android guidance is 48dp). */
export const TouchTarget = 48;

export function useTheme(): Palette {
  return useAppColorScheme() === 'dark' ? Colors.dark : Colors.light;
}
