import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { CHROME_INSETS, WebChrome, WIDE_CHROME } from '@/components/web-chrome';

import { useTheme } from '@/constants/theme';
import { useT, type StringKey } from '@/lib/i18n';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Screens at least this wide use the sidebar layout. */
const WIDE = 900;

const TABS: { name: string; title: StringKey; icon: IconName }[] = [
  { name: 'index', title: 'tabs.home', icon: 'home-variant' },
  { name: 'chat', title: 'tabs.chat', icon: 'message-text' },
  { name: 'ev', title: 'tabs.ev', icon: 'ev-station' },
  { name: 'parking', title: 'tabs.parking', icon: 'parking' },
  { name: 'trips', title: 'tabs.trips', icon: 'ticket-confirmation' },
];

export default function TabLayout() {
  const theme = useTheme();
  const t = useT();
  const width = useWindowDimensions().width;
  // Wide website: the HUD chrome (top bar, docks, mascot) replaces the tab bar. Tablets and
  // narrower desktop windows get a left sidebar; phones keep bottom tabs.
  const chrome = Platform.OS === 'web' && width >= WIDE_CHROME;
  const wide = width >= WIDE;
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarActiveBackgroundColor: wide ? theme.accentSoft : undefined,
          tabBarPosition: wide ? 'left' : 'bottom',
          tabBarVariant: wide ? 'material' : 'uikit',
          tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
          tabBarStyle: chrome
            ? { display: 'none' }
            : wide
              ? {
                  backgroundColor: theme.surface,
                  borderRightColor: theme.border,
                  width: 220,
                  paddingTop: 24,
                }
              : { backgroundColor: theme.background, borderTopColor: theme.border },
          sceneStyle: chrome
            ? {
                backgroundColor: theme.page,
                paddingLeft: CHROME_INSETS.left,
                paddingRight: CHROME_INSETS.right,
                paddingTop: CHROME_INSETS.top,
              }
            : { backgroundColor: theme.page },
          tabBarItemStyle: wide
            ? { borderRadius: 12, marginHorizontal: 10, marginVertical: 2 }
            : undefined,
          tabBarLabelStyle: wide
            ? { fontSize: 15, fontWeight: '700', marginLeft: 12 }
            : { fontSize: 12, fontWeight: '600' },
        }}>
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: t(tab.title),
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name={tab.icon} color={color} size={size} />
              ),
            }}
          />
        ))}
      </Tabs>
      <WebChrome />
    </>
  );
}
