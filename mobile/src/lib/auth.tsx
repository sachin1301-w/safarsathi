/**
 * Login state. The session token lives in the phone's secure storage (localStorage on web), is
 * attached to every API call, and is dropped when the server says it's no longer valid.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, setAuthToken, setOnUnauthorized, type AuthResponse } from './api';
import { getItem, setItem } from './secure-storage';

const TOKEN_KEY = 'safarsathi.token';

const storage = {
  get: () => getItem(TOKEN_KEY),
  set: (token: string | null) => setItem(TOKEN_KEY, token),
};

interface AuthState {
  /** "restoring" until the saved token has been read. */
  status: 'restoring' | 'signedOut' | 'signedIn';
  userId: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, language?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** The token's owner is only known after login, so a restored session uses the token as its key. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('restoring');
  const [userId, setUserId] = useState<string | null>(null);

  const signOutLocally = useCallback(() => {
    setAuthToken(null);
    storage.set(null);
    setUserId(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    setOnUnauthorized(signOutLocally);
    storage.get().then((token) => {
      setAuthToken(token);
      setUserId(token);
      setStatus(token ? 'signedIn' : 'signedOut');
    });
    return () => setOnUnauthorized(null);
  }, [signOutLocally]);

  const start = useCallback(async (res: AuthResponse) => {
    setAuthToken(res.token);
    await storage.set(res.token);
    setUserId(res.user.id);
    setStatus('signedIn');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => start(await api.login({ email, password })),
    [start],
  );
  const signup = useCallback(
    async (name: string, email: string, password: string, language?: string) =>
      start(await api.signup({ name, email, password, language })),
    [start],
  );
  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    signOutLocally();
  }, [signOutLocally]);

  return (
    <AuthContext.Provider value={{ status, userId, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
