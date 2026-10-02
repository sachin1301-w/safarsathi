import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api } from './api';
import type { Profile } from './types';

interface AppState {
  profile: Profile | null;
  profileError: string | null;
  refreshProfile: () => void;
  setLanguage: (code: string) => void;
}

const AppContext = createContext<AppState | null>(null);

/** Kothrud: the demo user's home, used until the profile loads. */
export const DEFAULT_CENTER = { lat: 18.5074, lng: 73.8077 };

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfile = useCallback(() => {
    api
      .me()
      .then((p) => {
        setProfile(p);
        setProfileError(null);
      })
      .catch((e: Error) => setProfileError(e.message));
  }, []);

  useEffect(refreshProfile, [refreshProfile]);

  const setLanguage = useCallback((code: string) => {
    // Optimistic: the UI switches immediately, the server copy follows.
    setProfile((p) => (p ? { ...p, language: code } : p));
    api.updateMe({ language: code }).catch(() => undefined);
  }, []);

  return (
    <AppContext.Provider value={{ profile, profileError, refreshProfile, setLanguage }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
