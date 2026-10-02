import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Icon } from '@/components/ui';
import { Spacing, StatusColors, useTheme } from '@/constants/theme';
import { formatKm } from '@/lib/format';
import type { Charger, ChargerStatus } from '@/lib/types';

export const STATUS_LABEL: Record<ChargerStatus, string> = {
  WORKING: 'Working',
  BUSY: 'Busy',
  BROKEN: 'Broken',
  UNKNOWN: 'Unknown',
};

export function ChargerRow({ charger, onPress }: { charger: Charger; onPress: () => void }) {
  const theme = useTheme();
  const color = StatusColors[charger.status];
  return (
    <Card onPress={onPress} accessibilityLabel={`${charger.name}, ${STATUS_LABEL[charger.status]}`}>
      <View style={styles.rowTop}>
        <View style={[styles.rowIcon, { backgroundColor: color }]}>
          <Icon name="ev-station" color="#FFFFFF" />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
            {charger.name}
          </Text>
          <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
            {charger.powerKw} kW · {charger.connectors.join(', ')} · ₹{charger.pricePerKwh}/kWh
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Badge label={STATUS_LABEL[charger.status]} color={color} />
          {charger.distanceKm !== undefined && (
            <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
              {formatKm(charger.distanceKm)}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowMeta: { fontSize: 13 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
});
