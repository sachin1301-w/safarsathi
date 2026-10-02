import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { BootScreen } from '@/components/boot-screen';

import { useTheme } from '@/constants/theme';
import { AlertsProvider } from '@/lib/alerts';
import { api } from '@/lib/api';
import { AppProvider } from '@/lib/app-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LocationProvider } from '@/lib/location';

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: {
          ...navTheme.colors,
          primary: theme.accent,
          background: theme.background,
          card: theme.surface,
        },
      }}>
      <AuthProvider>
        <Gate />
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

/** Boot animation until the backend answers, then login if needed, then the app. */
function Gate() {
  const theme = useTheme();
  const auth = useAuth();
  const [backendUp, setBackendUp] = useState(false);
  const [booted, setBooted] = useState(false);

  // Poll the backend until it answers; the boot screen keeps the bus running meanwhile.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () =>
      api
        .health()
        .then(() => !stopped && setBackendUp(true))
        .catch(() => {
          if (!stopped) timer = setTimeout(check, 2000);
        });
    check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  if (!booted)
    return (
      <BootScreen ready={backendUp && auth.status !== 'restoring'} onDone={() => setBooted(true)} />
    );
  if (auth.status !== 'signedIn') return <AuthScreen />;
  return (
    // Keyed by account so profile, alerts and location state start fresh for each user.
    <AppProvider key={auth.userId}>
      <AlertsProvider>
        <LocationProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.surface },
              headerTintColor: theme.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: theme.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="charger/[id]" options={{ title: 'Charger' }} />
            <Stack.Screen name="plan" options={{ title: 'Choose your route' }} />
            <Stack.Screen name="journey/[id]" options={{ title: 'Your journey' }} />
          </Stack>
        </LocationProvider>
      </AlertsProvider>
    </AppProvider>
  );
}
