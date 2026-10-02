import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { OptionBadges } from '@/components/journey-card';
import { LegRow } from '@/components/leg-row';
import { Card, ErrorState, Icon } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatDuration, formatInr, formatTime } from '@/lib/format';
import { MODE_INFO } from '@/lib/modes';
import type { Trip } from '@/lib/types';

export default function JourneyDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<MapView>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const fitMap = () =>
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: false,
    });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Your journey' }} />

      <View>
        <Text style={[styles.title, { color: theme.text }]}>{trip.title}</Text>
        <Text style={{ color: theme.textSecondary }}>
          Leave {formatTime(first.departAt)} · Arrive {formatTime(last.arriveAt)}
          {trip.arriveBy ? ` · Deadline ${formatTime(trip.arriveBy)}` : ''}
        </Text>
      </View>

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
          <Stat label="Total time" value={formatDuration(trip.totalMins)} />
          <Stat label="Total cost" value={formatInr(trip.totalCost)} />
          <Stat label="CO₂ saved" value={`${trip.co2SavedKg} kg`} color={theme.success} />
        </View>
        <View style={[styles.green, { backgroundColor: theme.accentSoft }]}>
          <Icon name="leaf" color={theme.success} />
          <Text style={{ color: theme.text, flex: 1 }}>
            Compared with driving the whole way alone. That&apos;s like{' '}
            {Math.max(1, Math.round(trip.co2SavedKg / 21))} tree
            {Math.round(trip.co2SavedKg / 21) > 1 ? 's' : ''} absorbing CO₂ for a year.
          </Text>
        </View>
      </Card>

      <Text style={[styles.section, { color: theme.text }]}>Step by step</Text>
      <View>
        {trip.legs.map((leg, i) => (
          <LegRow key={leg.id} leg={leg} isLast={i === trip.legs.length - 1} />
        ))}
      </View>
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
  title: { fontSize: 24, fontWeight: '800' },
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
