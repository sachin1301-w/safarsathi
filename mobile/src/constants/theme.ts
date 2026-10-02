import { useColorScheme } from 'react-native';

export const Accent = '#00BFA6';

export const Colors = {
  light: {
    text: '#0B0D0E',
    textSecondary: '#5B6266',
    background: '#FFFFFF',
    surface: '#F2F4F5',
    border: '#DDE2E4',
    accent: Accent,
    onAccent: '#002B25',
    success: '#1E9E5A',
    danger: '#D93636',
  },
  dark: {
    text: '#F4F7F8',
    textSecondary: '#A4ACB0',
    background: '#0B0D0E',
    surface: '#181C1E',
    border: '#2A3033',
    accent: Accent,
    onAccent: '#002B25',
    success: '#3DD68C',
    danger: '#FF6B6B',
  },
} as const;

export type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const Radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? Colors.dark : Colors.light;
}
