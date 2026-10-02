import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Icon } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { formatDuration, formatInr, formatTime } from '@/lib/format';
import { MODE_INFO, OPTION_INFO } from '@/lib/modes';
import type { Itinerary, OptionLabel } from '@/lib/types';

/** Collapses consecutive identical modes (e.g. two metro lines) into one icon. */
function modeChain(it: Itinerary) {
  return it.legs.map((l) => l.mode).filter((m, i, all) => i === 0 || all[i - 1] !== m);
}

export function OptionBadges({ badges }: { badges: OptionLabel[] }) {
  const theme = useTheme();
  if (!badges.length) {
    return <Text style={[styles.badgeText, { color: theme.textSecondary }]}>OTHER OPTION</Text>;
  }
  return (
    <View style={styles.badges}>
      {badges.map((b) => (
        <View key={b} style={[styles.badge, { backgroundColor: OPTION_INFO[b].color + '22' }]}>
          <Icon name={OPTION_INFO[b].icon} size={14} color={OPTION_INFO[b].color} />
          <Text style={[styles.badgeText, { color: OPTION_INFO[b].color }]}>
            {OPTION_INFO[b].label.toUpperCase()}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function JourneyCard({
  itinerary,
  onPress,
  compact,
}: {
  itinerary: Itinerary;
  onPress?: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  const first = itinerary.legs[0];
  const last = itinerary.legs[itinerary.legs.length - 1];
  const chain = modeChain(itinerary);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${(itinerary.badges ?? []).join(' ')} option, ${formatInr(itinerary.totalCost)}, ${formatDuration(itinerary.totalMins)}`}>
      <View style={styles.top}>
        <OptionBadges badges={itinerary.badges ?? [itinerary.label]} />
        <Text style={[styles.price, { color: theme.text }]}>{formatInr(itinerary.totalCost)}</Text>
      </View>

      <View style={styles.chain}>
        {chain.map((mode, i) => (
          <Fragment key={`${mode}-${i}`}>
            {i > 0 && <Icon name="chevron-right" size={16} color={theme.textSecondary} />}
            <View style={[styles.modeIcon, { backgroundColor: MODE_INFO[mode].color }]}>
              <Icon name={MODE_INFO[mode].icon} size={18} color="#FFFFFF" />
            </View>
          </Fragment>
        ))}
      </View>

      <Text style={[styles.times, { color: theme.text }]}>
        Leave {formatTime(first.departAt)} · Arrive {formatTime(last.arriveAt)} ·{' '}
        {formatDuration(itinerary.totalMins)}
      </Text>

      {!compact && (
        <View style={styles.footer}>
          <View style={styles.green}>
            <Icon name="leaf" size={16} color={theme.success} />
            <Text style={[styles.greenText, { color: theme.success }]}>
              Saves {itinerary.co2SavedKg} kg CO₂
            </Text>
          </View>
          {itinerary.onTime === false && (
            <View style={[styles.late, { backgroundColor: theme.dangerSoft }]}>
              <Icon name="clock-alert-outline" size={14} color={theme.danger} />
              <Text style={[styles.lateText, { color: theme.danger }]}>Misses your deadline</Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  price: { fontSize: 22, fontWeight: '800' },
  chain: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: Spacing.md,
  },
  modeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  times: { fontSize: 15, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  green: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  greenText: { fontSize: 14, fontWeight: '700' },
  late: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  lateText: { fontSize: 12, fontWeight: '700' },
});
