import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from '@/components/maps';

import { AlertBanner } from '@/components/alert-banner';
import { DemoFooter } from '@/components/demo-footer';
import { OptionBadges } from '@/components/journey-card';
import { LegRow } from '@/components/leg-row';
import { SimulateDelaySheet } from '@/components/simulate-delay';
import { TripStatusChip } from '@/components/trip-status';
import { Button, Card, ErrorState, Icon } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useAlerts } from '@/lib/alerts';
import { useT } from '@/lib/i18n';
import { api } from '@/lib/api';
import { formatDuration, formatInr, formatTime } from '@/lib/format';
import { BOOKABLE_MODES, MODE_INFO } from '@/lib/modes';
import type { Trip } from '@/lib/types';

export default function JourneyDetailScreen() {
  const theme = useTheme();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<MapView>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<'all' | string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const { alerts, dismiss } = useAlerts();
  const alert = alerts.find((a) => a.tripId === id);

  const load = useCallback(() => {
    api
      .trip(id)
      .then((t) => {
        setTrip(t);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);
  // A disruption alert for this trip means its legs changed: reload.
  useEffect(() => {
    if (alert) load();
  }, [alert, load]);

  async function bookAll() {
    setBooking('all');
    try {
      setTrip(await api.bookAll(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBooking(null);
    }
  }

  async function bookOne(legId: string) {
    setBooking(legId);
    try {
      await api.bookLeg(id, legId);
      setTrip(await api.trip(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBooking(null);
    }
  }

  if (error && !trip) return <ErrorState message={error} onRetry={load} />;
  if (!trip) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  const first = trip.legs[0];
  const last = trip.legs[trip.legs.length - 1];
  const coords = trip.legs.flatMap((l) => [
    { latitude: l.from.lat, longitude: l.from.lng },
    { latitude: l.to.lat, longitude: l.to.lng },
  ]);
  const unbooked = trip.legs.filter((l) => BOOKABLE_MODES.includes(l.mode) && !l.bookingRef);
  const anyBookable = trip.legs.some((l) => BOOKABLE_MODES.includes(l.mode));
  const fitMap = () =>
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: false,
    });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Your journey' }} />

      <View>
        <View style={styles.titleRow}>
          {/* Long-press the title: hidden "Simulate delay" control for the demo. */}
          <Pressable
            onLongPress={() => setSimulating(true)}
            delayLongPress={600}
            accessibilityHint="Long press to simulate a delay (demo)"
            style={{ flexShrink: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>{trip.title}</Text>
          </Pressable>
          <TripStatusChip status={trip.status} />
        </View>
        <Text style={{ color: theme.textSecondary }}>
          Leave {formatTime(first.departAt)} · Arrive {formatTime(last.arriveAt)}
          {trip.arriveBy ? ` · Deadline ${formatTime(trip.arriveBy)}` : ''}
        </Text>
      </View>

      {alert && (
        <AlertBanner
          alert={alert}
          onDismiss={alert.broken ? undefined : () => dismiss(alert.tripId)}
        />
      )}

      <View style={[styles.mapWrap, { borderColor: theme.border }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          onMapReady={fitMap}
          toolbarEnabled={false}>
          {trip.legs.map((l) => (
            <Polyline
              key={l.id}
              coordinates={[
                { latitude: l.from.lat, longitude: l.from.lng },
                { latitude: l.to.lat, longitude: l.to.lng },
              ]}
              strokeColor={MODE_INFO[l.mode].color}
              strokeWidth={5}
              lineDashPattern={l.mode === 'WALK' ? [6, 6] : undefined}
              geodesic={l.mode === 'FLIGHT'}
            />
          ))}
          <Marker
            coordinate={{ latitude: first.from.lat, longitude: first.from.lng }}
            title={first.from.name}
            pinColor="green"
          />
          <Marker
            coordinate={{ latitude: last.to.lat, longitude: last.to.lng }}
            title={last.to.name}
          />
        </MapView>
      </View>

      <Card>
        <OptionBadges badges={[trip.option]} />
        <View style={styles.stats}>
          <Stat label={t('journey.totalTime')} value={formatDuration(trip.totalMins)} />
          <Stat label={t('journey.totalCost')} value={formatInr(trip.totalCost)} />
          <Stat label={t('journey.co2')} value={`${trip.co2SavedKg} kg`} color={theme.success} />
        </View>
        {trip.co2SavedKg >= 1 && (
          <View style={[styles.green, { backgroundColor: theme.accentSoft }]}>
            <Icon name="leaf" color={theme.success} />
            <Text style={{ color: theme.text, flex: 1 }}>
              Compared with driving the whole way alone
              {trip.co2SavedKg >= 21
                ? `, that's what ${Math.round(trip.co2SavedKg / 21)} tree${trip.co2SavedKg >= 42 ? 's' : ''} absorb in a year.`
                : '.'}
            </Text>
          </View>
        )}
      </Card>

      {anyBookable && (
        <Button
          label={
            unbooked.length
              ? `${t('journey.bookAll')} (${unbooked.length})`
              : t('journey.allBooked')
          }
          icon={unbooked.length ? 'ticket-confirmation' : 'check-circle'}
          onPress={bookAll}
          loading={booking === 'all'}
          disabled={!unbooked.length || booking !== null}
        />
      )}
      {error && <Text style={{ color: theme.danger }}>{error}</Text>}

      <Text style={[styles.section, { color: theme.text }]}>{t('journey.steps')}</Text>
      <View>
        {trip.legs.map((leg, i) => (
          <LegRow
            key={leg.id}
            leg={leg}
            isLast={i === trip.legs.length - 1}
            action={
              BOOKABLE_MODES.includes(leg.mode) && !leg.bookingRef ? (
                <Button
                  label="Book"
                  icon="ticket-outline"
                  variant="secondary"
                  onPress={() => bookOne(leg.id)}
                  loading={booking === leg.id}
                  disabled={booking !== null}
                  style={styles.legBook}
                />
              ) : undefined
            }
          />
        ))}
      </View>
      <DemoFooter />
      <SimulateDelaySheet
        key={trip.id}
        trip={trip}
        visible={simulating}
        onClose={() => setSimulating(false)}
      />
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={[styles.statValue, { color: color ?? theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: '800', flexShrink: 1 },
  legBook: { alignSelf: 'flex-start', minHeight: 40, marginTop: Spacing.sm },
  mapWrap: {
    height: 220,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  stat: { gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800' },
  green: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  section: { fontSize: 18, fontWeight: '800' },
});
