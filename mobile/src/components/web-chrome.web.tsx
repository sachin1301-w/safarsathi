/**
 * Website frame around every tab (wide screens): an angled HUD top bar with the brand and links,
 * a left dock for the five sections, a right dock for theme / language / menu, and a floating
 * robot mascot that opens the copilot chat. Narrow browsers get just the mascot.
 * Styled with data attributes from app/+html.tsx.
 */
import { router, usePathname } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { Icon, isHovered, webData, webInteractive, type IconName } from '@/components/ui';
import { Accent, useTheme } from '@/constants/theme';
import { useMenu } from '@/lib/menu';
import { useAppColorScheme, useThemePreference } from '@/lib/theme-preference';

const fixed = (s: object) => ({ position: 'fixed', ...s }) as unknown as ViewStyle;

const DOCK: {
  path: '/' | '/chat' | '/ev' | '/parking' | '/trips';
  label: string;
  icon: IconName;
}[] = [
  { path: '/', label: 'Home', icon: 'home-variant-outline' },
  { path: '/chat', label: 'Copilot', icon: 'robot-happy-outline' },
  { path: '/ev', label: 'EV', icon: 'ev-station' },
  { path: '/parking', label: 'Parking', icon: 'parking' },
  { path: '/trips', label: 'Trips', icon: 'ticket-confirmation-outline' },
];

const NAV: { path: '/' | '/chat' | '/ev' | '/parking' | '/trips'; label: string; tag?: string }[] =
  [
    { path: '/chat', label: 'PLAN A TRIP', tag: 'AI' },
    { path: '/ev', label: 'EV CHARGERS' },
    { path: '/parking', label: 'PARKING' },
    { path: '/trips', label: 'MY TRIPS' },
  ];

/** Space the tab screens need on wide screens so the docks and top bar don't cover content. */
export const CHROME_INSETS = { left: 104, right: 88, top: 84 };
export const WIDE_CHROME = 1000;

export function WebChrome() {
  const wide = useWindowDimensions().width >= WIDE_CHROME;
  return (
    <>
      {wide && <TopBar />}
      {wide && <LeftDock />}
      {wide && <RightDock />}
      <Mascot />
    </>
  );
}

function TopBar() {
  const theme = useTheme();
  return (
    <>
      <Pressable
        onPress={() => router.navigate('/')}
        accessibilityRole="link"
        accessibilityLabel="SafarSathi home"
        style={[fixed({ top: 18, left: 26 }), styles.brand, webInteractive]}>
        <View style={[styles.brandMark, { backgroundColor: Accent }]}>
          <Icon name="map-marker-path" size={22} color="#00261F" />
        </View>
        <Text style={[styles.brandText, { color: theme.text }]} {...webData('display')}>
          SAFARSATHI
        </Text>
      </Pressable>
      <View style={[fixed({ top: 0, left: '50%' }), styles.navWrap]} pointerEvents="box-none">
        <View style={styles.nav} {...webData('hudNav')}>
          {NAV.map((n) => (
            <Pressable
              key={n.path}
              onPress={() => router.navigate(n.path)}
              accessibilityRole="link"
              style={[styles.navItem, webInteractive]}>
              {n.tag && (
                <Text style={styles.navTag} {...webData('display')}>
                  {n.tag}
                </Text>
              )}
              <Text style={[styles.navText, { color: theme.text }]} {...webData('hudLink')}>
                {n.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

function LeftDock() {
  const theme = useTheme();
  const path = usePathname();
  return (
    <View
      style={[
        fixed({ left: 18, top: '50%' }),
        styles.dock,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      {...webData('glass')}>
      {DOCK.map((d) => {
        const active = d.path === '/' ? path === '/' : path.startsWith(d.path);
        return (
          <Pressable
            key={d.path}
            onPress={() => router.navigate(d.path)}
            accessibilityRole="link"
            accessibilityLabel={d.label}
            style={(state) => [
              styles.dockItem,
              webInteractive,
              active && { backgroundColor: theme.accentSoft },
              isHovered(state) && !active && { backgroundColor: theme.surfaceAlt },
            ]}>
            <Icon name={d.icon} size={24} color={active ? theme.accent : theme.text} />
            <Text
              style={[styles.dockLabel, { color: active ? theme.accent : theme.textSecondary }]}>
              {d.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RightDock() {
  const theme = useTheme();
  const dark = useAppColorScheme() === 'dark';
  const { setPreference } = useThemePreference();
  const { openMenu, openLanguage } = useMenu();
  const items: { icon: IconName; label: string; onPress: () => void }[] = [
    {
      icon: dark ? 'white-balance-sunny' : 'weather-night',
      label: dark ? 'Light mode' : 'Dark mode',
      onPress: () => setPreference(dark ? 'light' : 'dark'),
    },
    { icon: 'translate', label: 'Language', onPress: openLanguage },
    {
      icon: 'navigation-variant-outline',
      label: 'Chargers near me',
      onPress: () => router.navigate('/ev'),
    },
    { icon: 'menu', label: 'Menu', onPress: openMenu },
  ];
  return (
    <View
      style={[
        fixed({ right: 18, top: '50%' }),
        styles.dock,
        styles.rightDock,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      {...webData('glass')}>
      {items.map((it) => (
        <Pressable
          key={it.label}
          onPress={it.onPress}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          style={(state) => [
            styles.iconButton,
            webInteractive,
            isHovered(state) && { backgroundColor: theme.accentSoft },
          ]}>
          <Icon name={it.icon} size={24} color={theme.text} />
        </Pressable>
      ))}
    </View>
  );
}

/** A little drone robot: propellers spin, it hovers, and a bubble invites you to chat. */
function Mascot() {
  const path = usePathname();
  // On narrow screens it sits above the bottom tab bar.
  const narrow = useWindowDimensions().width < WIDE_CHROME;
  if (path.startsWith('/chat')) return null;
  return (
    <Pressable
      onPress={() => router.navigate('/chat')}
      accessibilityRole="button"
      accessibilityLabel="Ask the SafarSathi copilot"
      style={[fixed({ right: narrow ? 14 : 26, bottom: narrow ? 84 : 34 }), styles.mascot, narrow && styles.mascotSmall]}
      {...webData('mascot')}>
      <View style={styles.bubble} {...webData('bubble')}>
        <Text style={styles.bubbleText}>Ask SafarSathi ✨</Text>
      </View>
      <View style={styles.rotorRow}>
        <View style={styles.rotor} {...webData('spin')} />
        <View style={styles.rotor} {...webData('spin')} />
      </View>
      <View style={styles.arm} />
      <View style={styles.body}>
        <View style={styles.visor}>
          <View style={styles.eye} />
          <View style={styles.eye} />
        </View>
      </View>
      <View style={styles.glow} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 60 },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 18, fontWeight: '900' },
  navWrap: { zIndex: 55, transform: [{ translateX: '-50%' }] },
  nav: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 34,
    paddingHorizontal: 70,
    paddingTop: 22,
    paddingBottom: 16,
  },
  navItem: { alignItems: 'center' },
  navTag: { position: 'absolute', top: -14, fontSize: 9, fontWeight: '800', color: '#E9B949' },
  navText: { fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  dock: {
    zIndex: 55,
    transform: [{ translateY: '-50%' }],
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
    alignItems: 'center',
  },
  rightDock: { paddingVertical: 12 },
  dockItem: { width: 70, paddingVertical: 10, borderRadius: 14, alignItems: 'center', gap: 4 },
  dockLabel: { fontSize: 11, fontWeight: '700' },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: { zIndex: 70, width: 96, alignItems: 'center' },
  mascotSmall: { transform: [{ scale: 0.8 }] },
  bubble: {
    position: 'absolute',
    bottom: 104,
    right: 0,
    backgroundColor: '#0E1418',
    borderColor: Accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 150,
  },
  bubbleText: { color: '#F2F5F5', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  rotorRow: { flexDirection: 'row', gap: 26 },
  rotor: { width: 34, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,191,166,.85)' },
  arm: { width: 64, height: 4, borderRadius: 2, backgroundColor: '#C9D6D6', marginTop: 2 },
  body: {
    marginTop: 4,
    width: 62,
    height: 52,
    borderRadius: 22,
    backgroundColor: '#F4F8F8',
    borderWidth: 2,
    borderColor: Accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Accent,
    shadowOpacity: 0.6,
    shadowRadius: 18,
  },
  visor: {
    width: 44,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0B1A2A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  eye: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22D3EE' },
  glow: {
    width: 46,
    height: 8,
    borderRadius: 23,
    backgroundColor: 'rgba(0,191,166,.35)',
    marginTop: 8,
  },
});
