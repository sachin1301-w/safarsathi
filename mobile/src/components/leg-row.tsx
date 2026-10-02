import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Icon } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { formatDuration, formatInr, formatTime } from '@/lib/format';
import { MODE_INFO } from '@/lib/modes';
import type { Leg } from '@/lib/types';

/** One leg in the vertical journey timeline. */
export function LegRow({ leg, isLast, action }: { leg: Leg; isLast: boolean; action?: ReactNode }) {
  const theme = useTheme();
  const info = MODE_INFO[leg.mode];
  const late = leg.status !== 'ON_TIME';
  const title =
    leg.mode === 'FLIGHT' || leg.mode === 'TRAIN' || leg.mode === 'INTERCITY_BUS'
      ? `${info.label} ${leg.serviceNo ?? ''}`
      : leg.serviceNo
        ? `${info.label} · ${leg.serviceNo}`
        : info.label;

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.icon, { backgroundColor: info.color }]}>
          <Icon name={info.icon} size={20} color="#FFFFFF" />
        </View>
        {!isLast && <View style={[styles.line, { backgroundColor: theme.border }]} />}
      </View>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={[styles.time, { color: theme.text }]}>{formatTime(leg.departAt)}</Text>
          <Text style={[styles.cost, { color: theme.text }]}>
            {leg.cost ? formatInr(leg.cost) : 'Free'}
          </Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{title.trim()}</Text>
        <Text style={[styles.route, { color: theme.textSecondary }]}>
          {leg.from.name} → {leg.to.name}
        </Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          {formatDuration(leg.durationMins)}
          {leg.distanceKm ? ` · ${leg.distanceKm} km` : ''}
          {leg.provider && !title.includes(leg.provider) ? ` · ${leg.provider}` : ''}
          {' · arrive '}
          {formatTime(leg.arriveAt)}
        </Text>
        {leg.notes ? (
          <Text style={[styles.meta, { color: theme.textSecondary }]}>{leg.notes}</Text>
        ) : null}
        <View style={styles.tags}>
          {late && (
            <Badge
              label={
                leg.status === 'CANCELLED' ? 'Cancelled' : `Delayed ${leg.delayMins ?? ''} min`
              }
              color={theme.danger}
            />
          )}
          {leg.bookingRef && (
            <Badge
              label={`Booked · ${leg.bookingRef}`}
              color={theme.accentSoft}
              textColor={theme.text}
            />
          )}
        </View>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.md },
  rail: { alignItems: 'center', width: 40 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  line: { width: 3, flex: 1, marginVertical: 4, borderRadius: 2 },
  body: { flex: 1, paddingBottom: Spacing.lg, gap: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 16, fontWeight: '800' },
  cost: { fontSize: 16, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700' },
  route: { fontSize: 14 },
  meta: { fontSize: 13 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
});
