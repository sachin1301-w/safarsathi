import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { STATUS_LABEL } from '@/components/charger-row';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  SectionTitle,
  type IconName,
} from '@/components/ui';
import { Radius, Spacing, StatusColors, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { Charger, ChargerReport, ChargerStatus } from '@/lib/types';

type Reportable = Exclude<ChargerStatus, 'UNKNOWN'>;
const REPORT_OPTIONS: { status: Reportable; icon: IconName }[] = [
  { status: 'WORKING', icon: 'check-circle' },
  { status: 'BUSY', icon: 'clock-outline' },
  { status: 'BROKEN', icon: 'close-octagon' },
];

export default function ChargerDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [charger, setCharger] = useState<(Charger & { reports: ChargerReport[] }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Reportable | null>(null);
  const [thanks, setThanks] = useState(false);

  const load = useCallback(() => {
    api
      .charger(id)
      .then((c) => {
        setCharger(c);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function report(status: Reportable) {
    setReporting(status);
    try {
      await api.reportCharger(id, status);
      setThanks(true);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReporting(null);
    }
  }

  if (error && !charger) return <ErrorState message={error} onRetry={load} />;
  if (!charger) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  const color = StatusColors[charger.status];
  const navigate = () =>
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${charger.lat},${charger.lng}&travelmode=driving`,
    );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: charger.operator }} />

      <View style={[styles.hero, { backgroundColor: color }]}>
        <Icon name="ev-station" size={36} color="#FFFFFF" />
        <View style={{ flex: 1 }}>
          <Text style={styles.heroStatus}>{STATUS_LABEL[charger.status]}</Text>
          <Text style={styles.heroName}>{charger.name}</Text>
          <Text style={styles.heroMeta}>Last verified {timeAgo(charger.lastVerified)}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat icon="lightning-bolt" label="Power" value={`${charger.powerKw} kW`} />
        <Stat icon="currency-inr" label="Price" value={`₹${charger.pricePerKwh}/kWh`} />
      </View>
      <Card>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Connectors</Text>
        <View style={styles.connectors}>
          {charger.connectors.map((c) => (
            <Badge key={c} label={c} color={theme.accentSoft} textColor={theme.text} />
          ))}
        </View>
      </Card>

      <Button label="Navigate" icon="navigation-variant" onPress={navigate} />

      <SectionTitle>Is it working right now?</SectionTitle>
      {thanks && (
        <Text style={[styles.thanks, { color: theme.success }]}>
          Thanks! Your report updates the map for everyone.
        </Text>
      )}
      <View style={styles.reportRow}>
        {REPORT_OPTIONS.map((o) => (
          <Button
            key={o.status}
            label={STATUS_LABEL[o.status]}
            icon={o.icon}
            variant="secondary"
            loading={reporting === o.status}
            disabled={reporting !== null}
            onPress={() => report(o.status)}
            style={[styles.reportButton, { borderColor: StatusColors[o.status] }]}
          />
        ))}
      </View>

      <SectionTitle>Recent reports</SectionTitle>
      {charger.reports.length === 0 ? (
        <Text style={{ color: theme.textSecondary }}>No reports yet. Be the first to report.</Text>
      ) : (
        charger.reports.map((r) => (
          <View key={r.id} style={[styles.reportItem, { borderColor: theme.border }]}>
            <View style={[styles.dot, { backgroundColor: StatusColors[r.status] }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.reportStatus, { color: theme.text }]}>
                {STATUS_LABEL[r.status]}
              </Text>
              {r.note ? <Text style={{ color: theme.textSecondary }}>{r.note}</Text> : null}
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{timeAgo(r.createdAt)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <Card style={styles.stat}>
      <Icon name={icon} color={theme.accent} />
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  hero: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  heroStatus: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroName: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  heroMeta: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  stats: { flexDirection: 'row', gap: Spacing.md },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600' },
  connectors: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  thanks: { fontWeight: '600' },
  reportRow: { flexDirection: 'row', gap: Spacing.sm },
  reportButton: { flex: 1, borderWidth: 2, paddingHorizontal: Spacing.sm },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  reportStatus: { fontWeight: '700' },
});
