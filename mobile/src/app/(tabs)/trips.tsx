import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TripStatusChip } from '@/components/trip-status';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  SectionTitle,
  SkeletonCard,
} from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatDay, formatInr, formatTime } from '@/lib/format';
import { MODE_INFO } from '@/lib/modes';
import type { Trip } from '@/lib/types';

interface Sections {
  upcoming: Trip[];
  planned: Trip[];
  past: Trip[];
}

function group(trips: Trip[], now: number): Sections {
  const ended = (t: Trip) =>
    t.status === 'DONE' ||
    t.status === 'REPLACED' ||
    new Date(t.legs[t.legs.length - 1].arriveAt).getTime() < now;
  const byDeparture = (a: Trip, b: Trip) =>
    new Date(a.legs[0].departAt).getTime() - new Date(b.legs[0].departAt).getTime();
  return {
    upcoming: trips.filter((t) => !ended(t) && t.status !== 'PLANNED').sort(byDeparture),
    planned: trips.filter((t) => !ended(t) && t.status === 'PLANNED').sort(byDeparture),
    past: trips.filter(ended).sort((a, b) => byDeparture(b, a)),
  };
}

export default function TripsScreen() {
  const theme = useTheme();
  const [sections, setSections] = useState<Sections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api
      .trips()
      .then((trips) => {
        setSections(group(trips, Date.now()));
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(load);

  const total = sections
    ? sections.upcoming.length + sections.planned.length + sections.past.length
    : 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.accent}
          />
        }>
        <Text style={[styles.title, { color: theme.text }]}>My trips</Text>
        <Text style={{ color: theme.textSecondary }}>Every ticket for every leg, in one place</Text>

        {error && !sections ? (
          <ErrorState message={error} onRetry={load} />
        ) : !sections ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : total === 0 ? (
          <EmptyState
            icon="ticket-outline"
            title="No trips yet"
            message="Plan a journey and book it, and your tickets will show up here."
            action={
              <Button label="Plan a trip" icon="magnify" onPress={() => router.navigate('/')} />
            }
          />
        ) : (
          <>
            <TripSection title="Upcoming" trips={sections.upcoming} />
            <TripSection title="Saved plans" trips={sections.planned} />
            <TripSection title="Past trips" trips={sections.past} muted />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TripSection({ title, trips, muted }: { title: string; trips: Trip[]; muted?: boolean }) {
  if (!trips.length) return null;
  return (
    <View style={styles.section}>
      <SectionTitle>{title}</SectionTitle>
      {trips.map((t) => (
        <TripCard key={t.id} trip={t} muted={muted} />
      ))}
    </View>
  );
}

function TripCard({ trip, muted }: { trip: Trip; muted?: boolean }) {
  const theme = useTheme();
  const first = trip.legs[0];
  const last = trip.legs[trip.legs.length - 1];
  const modes = trip.legs.map((l) => l.mode).filter((m, i, all) => i === 0 || all[i - 1] !== m);
  const booked = trip.legs.filter((l) => l.bookingRef);
  return (
    <Card
      onPress={() => router.push({ pathname: '/journey/[id]', params: { id: trip.id } })}
      style={[
        muted && { opacity: 0.75 },
        trip.status === 'DISRUPTED' && { borderColor: theme.danger, borderWidth: 2 },
      ]}
      accessibilityLabel={`${trip.title}, ${trip.status}`}>
      <View style={styles.top}>
        <Text style={[styles.tripTitle, { color: theme.text }]} numberOfLines={1}>
          {trip.title}
        </Text>
        <TripStatusChip status={trip.status} />
      </View>
      <Text style={{ color: theme.textSecondary, marginTop: 2 }}>
        {formatDay(first.departAt)} · {formatTime(first.departAt)} → {formatTime(last.arriveAt)} ·{' '}
        {formatInr(trip.totalCost)}
      </Text>
      <View style={styles.modes}>
        {modes.map((m, i) => (
          <Fragment key={`${m}-${i}`}>
            {i > 0 && <Icon name="chevron-right" size={14} color={theme.textSecondary} />}
            <View style={[styles.modeDot, { backgroundColor: MODE_INFO[m].color }]}>
              <Icon name={MODE_INFO[m].icon} size={14} color="#FFFFFF" />
            </View>
          </Fragment>
        ))}
      </View>
      {booked.length > 0 && (
        <View style={[styles.refs, { backgroundColor: theme.surfaceAlt }]}>
          {booked.map((l) => (
            <View key={l.id} style={styles.refRow}>
              <Icon name={MODE_INFO[l.mode].icon} size={16} color={theme.textSecondary} />
              <Text style={{ color: theme.textSecondary, flex: 1 }} numberOfLines={1}>
                {MODE_INFO[l.mode].label} {l.serviceNo ?? ''}
              </Text>
              <Text style={[styles.ref, { color: theme.text }]}>{l.bookingRef}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  title: { fontSize: 28, fontWeight: '800', marginTop: Spacing.sm },
  section: { gap: Spacing.sm },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  tripTitle: { fontSize: 17, fontWeight: '800', flex: 1 },
  modes: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  modeDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refs: { marginTop: Spacing.sm, borderRadius: Radius.md, padding: Spacing.sm, gap: 4 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ref: { fontWeight: '800', letterSpacing: 1, fontVariant: ['tabular-nums'] },
});
