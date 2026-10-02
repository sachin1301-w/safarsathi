/** Account menu: profile, trip stats, appearance, language, shortcuts and log out. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { nativeName } from '@/components/language-picker';
import { FadeIn, Icon, type IconName } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { useAuth } from '@/lib/auth';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference';

const APPEARANCE: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: 'system', label: 'System', icon: 'theme-light-dark' },
  { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Dark', icon: 'weather-night' },
];

export function AccountSheet({
  visible,
  onClose,
  onChangeLanguage,
}: {
  visible: boolean;
  onClose: () => void;
  onChangeLanguage: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const { logout } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const [stats, setStats] = useState<{ total: number; booked: number; upcoming: number } | null>(
    null,
  );

  useEffect(() => {
    if (!visible) return;
    api
      .trips()
      .then((trips) => {
        const now = Date.now();
        setStats({
          total: trips.filter((t) => t.status !== 'REPLACED').length,
          booked: trips.filter((t) => t.legs.some((l) => l.bookingRef)).length,
          upcoming: trips.filter(
            (t) =>
              t.status !== 'REPLACED' &&
              new Date(t.legs[t.legs.length - 1].arriveAt).getTime() > now,
          ).length,
        });
      })
      .catch(() => undefined);
  }, [visible]);

  const go = (path: '/trips' | '/ev' | '/parking') => {
    onClose();
    router.navigate(path);
  };

  const confirmLogout = () =>
    Alert.alert('Log out?', 'Your trips stay saved in your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          onClose();
          logout();
        },
      },
    ]);

  const name = profile?.name ?? 'Traveller';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close account menu"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.md },
        ]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FadeIn style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
              <Text style={[styles.avatarText, { color: theme.onAccent }]}>
                {name.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {name}
              </Text>
              {profile?.email && (
                <Text style={{ color: theme.textSecondary }} numberOfLines={1}>
                  {profile.email}
                </Text>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Icon name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </FadeIn>

          <FadeIn
            delay={60}
            style={[styles.stats, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {(
              [
                ['Trips', stats?.total],
                ['Booked', stats?.booked],
                ['Upcoming', stats?.upcoming],
              ] as const
            ).map(([label, n], i) => (
              <View
                key={label}
                style={[
                  styles.stat,
                  i > 0 && {
                    borderLeftColor: theme.border,
                    borderLeftWidth: StyleSheet.hairlineWidth,
                  },
                ]}>
                <Text style={[styles.statValue, { color: theme.text }]}>{n ?? '–'}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
              </View>
            ))}
          </FadeIn>

          <FadeIn delay={120} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APPEARANCE</Text>
            <View style={[styles.segment, { backgroundColor: theme.surfaceAlt }]}>
              {APPEARANCE.map((o) => {
                const selected = preference === o.value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => setPreference(o.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.segmentItem, selected && { backgroundColor: theme.surface }]}>
                    <Icon
                      name={o.icon}
                      size={20}
                      color={selected ? theme.accent : theme.textSecondary}
                    />
                    <Text
                      style={{
                        color: selected ? theme.text : theme.textSecondary,
                        fontWeight: '700',
                      }}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FadeIn>

          <FadeIn delay={180} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PREFERENCES</Text>
            <View
              style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Row
                icon="translate"
                label="Language"
                value={nativeName(profile?.language ?? 'en-IN')}
                onPress={() => {
                  onClose();
                  onChangeLanguage();
                }}
              />
              <Row
                icon="home-variant-outline"
                label="Home"
                value={profile?.home?.name ?? 'Not set'}
              />
              {profile?.hasEv && (
                <Row
                  icon="car-electric"
                  label="My EV"
                  value={[profile.evConnector, profile.evRangeKm && `${profile.evRangeKm} km`]
                    .filter(Boolean)
                    .join(' · ')}
                />
              )}
            </View>
          </FadeIn>

          <FadeIn delay={240} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SHORTCUTS</Text>
            <View
              style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Row icon="ticket-outline" label="My trips" onPress={() => go('/trips')} />
              <Row icon="ev-station" label="EV chargers near me" onPress={() => go('/ev')} />
              <Row icon="parking" label="Parking near me" onPress={() => go('/parking')} />
            </View>
          </FadeIn>

          <FadeIn delay={300}>
            <Pressable
              onPress={confirmLogout}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.logout,
                { backgroundColor: theme.dangerSoft, opacity: pressed ? 0.8 : 1 },
              ]}>
              <Icon name="logout" size={20} color={theme.danger} />
              <Text style={{ color: theme.danger, fontWeight: '800', fontSize: 16 }}>Log out</Text>
            </Pressable>
            <Text style={[styles.version, { color: theme.textSecondary }]}>SafarSathi · v1.0</Text>
          </FadeIn>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceAlt }]}>
      <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} size={18} color={theme.accent} />
      </View>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      {value ? (
        <Text style={{ color: theme.textSecondary, maxWidth: '45%' }} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && <Icon name="chevron-right" size={20} color={theme.textSecondary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: Spacing.sm },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.lg, paddingBottom: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 26, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800' },
  stats: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontWeight: '800' },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  segment: { flexDirection: 'row', borderRadius: Radius.lg, padding: 4 },
  segmentItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  group: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  logout: {
    minHeight: 52,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  version: { textAlign: 'center', fontSize: 12, marginTop: Spacing.md },
});
