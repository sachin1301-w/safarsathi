/**
 * Light / dark / follow-the-phone appearance. Appearance.setColorScheme overrides the scheme for
 * the whole app, so every useColorScheme() (theme colours, map tiles, navigation) follows it.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { getItem, setItem } from './secure-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'safarsathi.theme';

const apply = (pref: ThemePreference) =>
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);

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
