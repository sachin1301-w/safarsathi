import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useWindowDimensions } from 'react-native';

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
  // Desktop browsers and tablets get a left sidebar instead of bottom tabs.
  const wide = useWindowDimensions().width >= WIDE;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarActiveBackgroundColor: wide ? theme.accentSoft : undefined,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        tabBarStyle: wide
          ? {
              backgroundColor: theme.surface,
              borderRightColor: theme.border,
              width: 220,
              paddingTop: 24,
            }
          : { backgroundColor: theme.background, borderTopColor: theme.border },
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
  );
}
