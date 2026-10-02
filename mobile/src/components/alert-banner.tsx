import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { TripAlert } from '@/lib/alerts';
import { useT } from '@/lib/i18n';

/** Opens the copilot with a request to fix the trip. The trip id goes to the AI, not on screen. */
export function fixMyTrip(alert: Pick<TripAlert, 'tripId' | 'title'>) {
  router.navigate({
    pathname: '/chat',
    params: { fix: alert.tripId, title: alert.title, n: String(Date.now()) },
  });
}

export function AlertBanner({ alert, onDismiss }: { alert: TripAlert; onDismiss?: () => void }) {
  const t = useT();
  const bg = alert.broken ? '#DC2626' : '#D97706';
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole="alert">
      <View style={styles.top}>
        <Icon
          name={alert.broken ? 'alert-octagon' : 'clock-alert-outline'}
          color="#FFFFFF"
          size={24}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{alert.title}</Text>
          <Text style={styles.message}>{alert.message}</Text>
        </View>
        {onDismiss && (
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss alert">
            <Icon name="close" color="#FFFFFF" />
          </Pressable>
        )}
      </View>
      {alert.broken && (
        <Pressable
          onPress={() => fixMyTrip(alert)}
          accessibilityRole="button"
          accessibilityLabel="Fix my trip"
          style={({ pressed }) => [styles.fix, pressed && { opacity: 0.85 }]}>
          <Icon name="auto-fix" color={bg} />
          <Text style={[styles.fixText, { color: bg }]}>{t('alert.fix')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
  top: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  title: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  message: { color: '#FFFFFF', fontSize: 15, lineHeight: 21, marginTop: 2 },
  fix: {
    minHeight: TouchTarget,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  fixText: { fontWeight: '800', fontSize: 16 },
});
