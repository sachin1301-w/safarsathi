import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { useTheme } from '@/constants/theme';
import { AppProvider } from '@/lib/app-context';

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
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: theme.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="charger/[id]" options={{ title: 'Charger' }} />
        </Stack>
      </AppProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
