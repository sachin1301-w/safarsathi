/**
 * "Continue with Google" on the website, using Google Identity Services. Google returns a signed
 * ID token, which the backend verifies before logging in. Hidden when the server has no
 * GOOGLE_CLIENT_ID.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppColorScheme } from '@/lib/theme-preference';

import { useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Google = {
  accounts: {
    id: {
      initialize: (o: object) => void;
      renderButton: (el: HTMLElement, o: object) => void;
    };
  };
};

let gisPromise: Promise<Google> | null = null;
function loadGis(): Promise<Google> {
  const w = window as unknown as { google?: Google };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  gisPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve(w.google!);
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Google sign-in could not load'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const theme = useTheme();
  const dark = useAppColorScheme() === 'dark';
  const { loginWithGoogle } = useAuth();
  const host = useRef<View>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const handlers = useRef({ loginWithGoogle, onError });
  useEffect(() => {
    handlers.current = { loginWithGoogle, onError };
  });

  useEffect(() => {
    api
      .authConfig()
      .then((c) => setClientId(c.googleClientId))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!clientId) return;
    loadGis()
      .then((google) => {
        const el = host.current as unknown as HTMLElement | null;
        if (!el) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }: { credential: string }) =>
            handlers.current
              .loginWithGoogle(credential)
              .catch((e: Error) => handlers.current.onError(e.message)),
        });
        el.innerHTML = '';
        google.accounts.id.renderButton(el, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: Math.min(el.clientWidth || 360, 400),
        });
      })
      .catch((e: Error) => handlers.current.onError(e.message));
  }, [clientId, dark]);

  if (!clientId) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>or</Text>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>
      <View ref={host} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, alignItems: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  button: { alignSelf: 'stretch', alignItems: 'center', minHeight: 44 },
});
