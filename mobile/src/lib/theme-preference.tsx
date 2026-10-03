/**
 * Light / dark / follow-the-device appearance. Screens read the result with useAppColorScheme().
 * On phones Appearance.setColorScheme also switches native parts (keyboard, status bar); the
 * website's React Native has no such override, which is why the choice is kept here too.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import { getItem, setItem } from './secure-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'safarsathi.theme';

const apply = (pref: ThemePreference) => {
  if (Platform.OS !== 'web') Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
};

const ThemePreferenceContext = createContext<{
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
} | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    getItem(KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setPref(saved);
        apply(saved);
      }
    });
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    apply(p);
    setItem(KEY, p === 'system' ? null : p);
  }, []);

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used inside <ThemePreferenceProvider>');
  return ctx;
}

/** The colour scheme to draw with: the user's choice, or the device's when set to System. */
export function useAppColorScheme(): 'light' | 'dark' {
  const device = useColorScheme();
  const preference = useContext(ThemePreferenceContext)?.preference ?? 'system';
  if (preference !== 'system') return preference;
  return device === 'dark' ? 'dark' : 'light';
}
