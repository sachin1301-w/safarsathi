import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Icon } from '@/components/ui';
import { Spacing, StatusColors, useTheme } from '@/constants/theme';
import { formatKm, formatKw, formatPerKwh } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Charger } from '@/lib/types';

export function ChargerRow({ charger, onPress }: { charger: Charger; onPress: () => void }) {
  const theme = useTheme();
  const t = useT();
  const statusLabel = t(`charger.${charger.status}`);
  const color = StatusColors[charger.status];
  return (
    <Card onPress={onPress} accessibilityLabel={`${charger.name}, ${statusLabel}`}>
      <View style={styles.rowTop}>
        <View style={[styles.rowIcon, { backgroundColor: color }]}>
          <Icon name="ev-station" color="#FFFFFF" />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
            {charger.name}
          </Text>
          <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
            {[
              formatKw(charger.powerKw),
              charger.connectors.join(', '),
              formatPerKwh(charger.pricePerKwh),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Badge label={statusLabel} color={color} />
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
