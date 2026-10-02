import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';

type Status = 'checking' | 'connected' | 'offline';

const STATUS_LABEL: Record<Status, string> = {
  checking: 'Connecting…',
  connected: 'Connected',
  offline: 'Offline',
};

export default function HomeScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);

  function runHealthCheck() {
    api
      .health()
      .then((res) => {
        setStatus(res.ok ? 'connected' : 'offline');
        setError(null);
      })
      .catch((e: unknown) => {
        setStatus('offline');
        setError(e instanceof Error ? e.message : String(e));
      });
  }

  function retry() {
    setStatus('checking');
    setError(null);
    runHealthCheck();
  }

  useEffect(runHealthCheck, []);

  const dotColor = status === 'connected' ? theme.success : theme.danger;

  return (
    <Screen>
      <Text style={[styles.greeting, { color: theme.text }]}>Namaste</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Your SafarSathi travel copilot
      </Text>

      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Check backend connection"
        style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {status === 'checking' ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        )}
        <View style={styles.statusBody}>
          <Text style={[styles.statusText, { color: theme.text }]}>{STATUS_LABEL[status]}</Text>
          <Text style={[styles.statusDetail, { color: theme.textSecondary }]} numberOfLines={2}>
            {error ?? api.baseUrl}
          </Text>
        </View>
        {status === 'offline' && <Text style={[styles.retry, { color: theme.accent }]}>Retry</Text>}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 32, fontWeight: '700', marginTop: Spacing.md },
  subtitle: { fontSize: 16, marginTop: -Spacing.sm },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    minHeight: 64,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 12, height: 12, borderRadius: Radius.pill },
  statusBody: { flex: 1 },
  statusText: { fontSize: 18, fontWeight: '600' },
  statusDetail: { fontSize: 13 },
  retry: { fontWeight: '600' },
});
