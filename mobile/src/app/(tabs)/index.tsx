import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountSheet } from '@/components/account-sheet';
import { AlertBanner } from '@/components/alert-banner';
import { DemoFooter } from '@/components/demo-footer';
import { JourneyCard } from '@/components/journey-card';
import { LanguagePicker, nativeName } from '@/components/language-picker';
import { TripStatusChip } from '@/components/trip-status';
import { Button, Card, Chip, FadeIn, Icon, SectionTitle, type IconName } from '@/components/ui';
import { Radius, Spacing, TouchTarget, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAlerts } from '@/lib/alerts';
import { useT, type StringKey } from '@/lib/i18n';
import { useApp } from '@/lib/app-context';
import type { Trip } from '@/lib/types';

type Status = 'checking' | 'connected' | 'offline';

const QUICK: { label: StringKey; icon: IconName; to: string; from?: string }[] = [
  { label: 'home.chipHome', icon: 'home-variant', to: 'home', from: 'office' },
  { label: 'home.chipOffice', icon: 'briefcase', to: 'office' },
  { label: 'home.chipAirport', icon: 'airplane', to: 'Pune Airport' },
  { label: 'home.chipStation', icon: 'train', to: 'Pune Railway Station' },
];

function greeting(): StringKey {
  const h = new Date().getHours();
  if (h < 12) return 'home.morning';
  if (h < 17) return 'home.afternoon';
  return 'home.evening';
}

export default function HomeScreen() {
  const theme = useTheme();
  const { profile, setLanguage } = useApp();
  const [accountOpen, setAccountOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [status, setStatus] = useState<Status>('checking');
  const [query, setQuery] = useState('');
  const [hello] = useState(greeting);
  const t = useT();
  const { alerts, dismiss, refresh } = useAlerts();
  const [nextTrip, setNextTrip] = useState<Trip | null>(null);

  // The next booked or disrupted trip that hasn't finished yet.
  const loadTrips = useCallback(() => {
    api
      .trips()
      .then((trips) => {
        const now = Date.now();
        const active = trips
          .filter((t) => ['BOOKED', 'IN_PROGRESS', 'DISRUPTED'].includes(t.status))
          .filter((t) => new Date(t.legs[t.legs.length - 1].arriveAt).getTime() > now)
          .sort(
            (a, b) =>
              new Date(a.legs[0].departAt).getTime() - new Date(b.legs[0].departAt).getTime(),
          );
        setNextTrip(active[0] ?? null);
      })
      .catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadTrips();
    }, [refresh, loadTrips]),
  );
  // A new alert can change the next trip's status.
  useEffect(loadTrips, [alerts, loadTrips]);

  const checkHealth = useCallback(() => {
    api
      .health()
      .then((r) => setStatus(r.ok ? 'connected' : 'offline'))
      .catch(() => setStatus('offline'));
  }, []);
  useEffect(checkHealth, [checkHealth]);
  const recheck = () => {
    setStatus('checking');
    checkHealth();
    refresh();
    loadTrips();
  };

  const goTo = (to: string, from?: string) =>
    router.push({ pathname: '/plan', params: { to, ...(from ? { from } : {}) } });

  // Free text goes to the copilot; the nonce makes a repeated query run again.
  const submit = () => {
    if (!query.trim()) return;
    router.navigate({ pathname: '/chat', params: { q: query.trim(), n: String(Date.now()) } });
    setQuery('');
  };
  const voice = () => router.navigate({ pathname: '/chat', params: { voice: String(Date.now()) } });

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={[styles.logo, { backgroundColor: theme.accent }]}>
            <Icon name="map-marker-path" size={22} color={theme.onAccent} />
          </View>
          <Text style={[styles.brand, { color: theme.text }]} numberOfLines={1}>
            SafarSathi
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Change language"
            style={[
              styles.status,
              { backgroundColor: theme.accentSoft, borderColor: theme.accent },
            ]}>
            <Icon name="translate" size={14} color={theme.accent} />
            <Text style={[styles.statusText, { color: theme.text }]}>
              {nativeName(profile?.language ?? 'en-IN')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setAccountOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Account and settings"
            style={[styles.avatar, { backgroundColor: theme.accent }]}>
            <Text style={[styles.avatarText, { color: theme.onAccent }]}>
              {(profile?.name ?? '?').trim().charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>

        {status === 'offline' && (
          <FadeIn>
            <Card style={{ borderColor: theme.danger, gap: Spacing.sm }}>
              <View style={styles.offlineRow}>
                <Icon name="lan-disconnect" size={22} color={theme.danger} />
                <Text style={[styles.offlineTitle, { color: theme.text }]}>
                  {t('status.offline')}
                </Text>
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                Can&apos;t reach the SafarSathi server at {api.baseUrl}. Make sure npm run dev is
                running in backend/ on the laptop that runs Expo.
              </Text>
              <Button
                label={t('common.retry')}
                icon="refresh"
                variant="secondary"
                onPress={recheck}
              />
            </Card>
          </FadeIn>
        )}

        {alerts.map((a) => (
          <AlertBanner
            key={a.tripId}
            alert={a}
            onDismiss={a.broken ? undefined : () => dismiss(a.tripId)}
          />
        ))}

        <View>
          <Text style={[styles.hello, { color: theme.textSecondary }]}>
            {t(hello)}
            {profile ? `, ${profile.name}` : ''}
          </Text>
          <Text style={[styles.headline, { color: theme.text }]}>{t('home.headline')}</Text>
        </View>

        <View
          style={[
            styles.searchCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <Icon name="magnify" size={26} color={theme.accent} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            placeholder={t('home.placeholder')}
            placeholderTextColor={theme.textSecondary}
            returnKeyType="go"
            style={[styles.searchInput, { color: theme.text }]}
            accessibilityLabel={t('home.placeholder')}
          />
          <Pressable
            onPress={voice}
            accessibilityRole="button"
            accessibilityLabel="Speak your trip"
            style={[styles.goButton, { backgroundColor: theme.surfaceAlt }]}>
            <Icon name="microphone" size={24} color={theme.accent} />
          </Pressable>
          <Pressable
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="Plan trip"
            style={[styles.goButton, { backgroundColor: theme.accent }]}>
            <Icon name="arrow-right" size={24} color={theme.onAccent} />
          </Pressable>
        </View>

        <View style={styles.chips}>
          {QUICK.map((q) => (
            <Chip
              key={q.label}
              label={t(q.label)}
              icon={q.icon}
              onPress={() => goTo(q.to, q.from)}
            />
          ))}
        </View>

        {nextTrip && (
          <View style={styles.section}>
            <SectionTitle action={<TripStatusChip status={nextTrip.status} />}>
              {t('home.nextTrip')}
            </SectionTitle>
            <JourneyCard
              itinerary={{
                ...nextTrip,
                label: nextTrip.option,
                badges: [nextTrip.option],
                arriveBy: nextTrip.arriveBy ?? undefined,
              }}
              onPress={() =>
                router.push({ pathname: '/journey/[id]', params: { id: nextTrip.id } })
              }
            />
          </View>
        )}
        <DemoFooter />
      </ScrollView>
      <AccountSheet
        visible={accountOpen}
        onClose={() => setAccountOpen(false)}
        onChangeLanguage={() => setPickerOpen(true)}
      />
      <LanguagePicker
        visible={pickerOpen}
        value={profile?.language ?? 'en-IN'}
        onSelect={setLanguage}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 24, fontWeight: '800', flex: 1, letterSpacing: 0.2 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  offlineTitle: { fontSize: 17, fontWeight: '700' },
  statusText: { fontSize: 12, fontWeight: '600' },
  hello: { fontSize: 16, fontWeight: '600' },
  headline: { fontSize: 32, fontWeight: '800', marginTop: 2 },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    minHeight: 68,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 20, fontWeight: '600', paddingVertical: Spacing.md },
  goButton: {
    width: TouchTarget + 4,
    height: TouchTarget + 4,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  section: { gap: Spacing.sm },
});
