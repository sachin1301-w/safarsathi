import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useTheme } from '@/constants/theme';
import { useT, type StringKey } from '@/lib/i18n';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
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
