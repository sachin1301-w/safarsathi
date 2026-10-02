import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, Icon, type IconName } from '@/components/ui';
import { Radius, Spacing, TouchTarget, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app-context';

type Status = 'checking' | 'connected' | 'offline';

const QUICK: { label: string; icon: IconName; to: string; from?: string }[] = [
  { label: 'Home', icon: 'home-variant', to: 'home', from: 'office' },
  { label: 'Office', icon: 'briefcase', to: 'office' },
  { label: 'Airport', icon: 'airplane', to: 'Pune Airport' },
  { label: 'Station', icon: 'train', to: 'Pune Railway Station' },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const theme = useTheme();
  const { profile } = useApp();
  const [status, setStatus] = useState<Status>('checking');
  const [query, setQuery] = useState('');
  const [hello] = useState(greeting);

  useEffect(() => {
    api
      .health()
      .then((r) => setStatus(r.ok ? 'connected' : 'offline'))
      .catch(() => setStatus('offline'));
  }, []);

  const goTo = (to: string, from?: string) =>
    router.push({ pathname: '/plan', params: { to, ...(from ? { from } : {}) } });

  // Free text goes to the copilot; the nonce makes a repeated query run again.
  const submit = () => {
    if (!query.trim()) return;
    router.navigate({ pathname: '/chat', params: { q: query.trim(), n: String(Date.now()) } });
    setQuery('');
  };
  const voice = () => router.navigate({ pathname: '/chat', params: { voice: String(Date.now()) } });

  const dot =
    status === 'connected' ? theme.success : status === 'offline' ? theme.danger : theme.muted;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={[styles.logo, { backgroundColor: theme.accent }]}>
            <Icon name="map-marker-path" size={22} color={theme.onAccent} />
          </View>
          <Text style={[styles.brand, { color: theme.text }]}>SafarSathi</Text>
          <View
            style={[styles.status, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>
              {status === 'connected'
                ? 'Connected'
                : status === 'offline'
                  ? 'Offline'
                  : 'Connecting'}
            </Text>
          </View>
        </View>

        <View>
          <Text style={[styles.hello, { color: theme.textSecondary }]}>
            {hello}
            {profile ? `, ${profile.name}` : ''}
          </Text>
          <Text style={[styles.headline, { color: theme.text }]}>Where to today?</Text>
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
            placeholder="Where to?"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="go"
            style={[styles.searchInput, { color: theme.text }]}
            accessibilityLabel="Where to?"
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
            <Chip key={q.label} label={q.label} icon={q.icon} onPress={() => goTo(q.to, q.from)} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 20, fontWeight: '800', flex: 1 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
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
});
