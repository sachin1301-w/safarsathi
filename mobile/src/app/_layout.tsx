import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { useTheme } from '@/constants/theme';
import { AlertsProvider } from '@/lib/alerts';
import { AppProvider } from '@/lib/app-context';
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
      <AppProvider>
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
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
