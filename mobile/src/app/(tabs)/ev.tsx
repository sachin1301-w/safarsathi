import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapPin } from '@/components/map-pin';
import { ChargerRow, STATUS_LABEL } from '@/components/charger-row';
import { Button, Chip, EmptyState, ErrorState, Icon, SkeletonCard } from '@/components/ui';
import { Radius, Spacing, StatusColors, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { DEFAULT_CENTER, useApp } from '@/lib/app-context';
import type { Charger, ChargerStatus } from '@/lib/types';

const CONNECTORS = ['All', 'CCS2', 'Type2', 'GBT', 'Bharat AC001', 'CHAdeMO'];
const POWER = [
  { label: 'Any kW', minKw: undefined },
  { label: '22+ kW', minKw: 22 },
  { label: '50+ kW', minKw: 50 },
];

export default function EvScreen() {
  const theme = useTheme();
  const { profile } = useApp();
  const center = profile?.home ?? DEFAULT_CENTER;

  const [connector, setConnector] = useState('All');
  const [minKw, setMinKw] = useState<number | undefined>(undefined);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [chargers, setChargers] = useState<Charger[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .chargers({
        lat: center.lat,
        lng: center.lng,
        radiusKm: 150, // include the highway chargers towards Mahabaleshwar and Lonavala
        connector: connector === 'All' ? undefined : connector,
        minKw,
      })
      .then((list) => {
        setChargers(list);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [center.lat, center.lng, connector, minKw]);

  // Reload whenever the tab regains focus, so a report made on the detail screen shows at once.
  useFocusEffect(load);

  const counts = useMemo(() => {
    const c: Record<ChargerStatus, number> = { WORKING: 0, BUSY: 0, BROKEN: 0, UNKNOWN: 0 };
    chargers?.forEach((ch) => c[ch.status]++);
    return c;
  }, [chargers]);

  const selected = chargers?.find((c) => c.id === selectedId) ?? null;
  const openDetail = (id: string) => router.push({ pathname: '/charger/[id]', params: { id } });

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>EV chargers</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Live status from operators and drivers like you
          </Text>
        </View>
        <Pressable
          onPress={() => setView(view === 'map' ? 'list' : 'map')}
          accessibilityRole="button"
          accessibilityLabel={view === 'map' ? 'Show list' : 'Show map'}
          style={[styles.toggle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Icon name={view === 'map' ? 'format-list-bulleted' : 'map-outline'} size={22} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}>
        {CONNECTORS.map((c) => (
          <Chip key={c} label={c} selected={connector === c} onPress={() => setConnector(c)} />
        ))}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        {POWER.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            icon="lightning-bolt"
            selected={minKw === p.minKw}
            onPress={() => setMinKw(p.minKw)}
          />
        ))}
      </ScrollView>

      <View style={styles.legend}>
        {(['WORKING', 'BUSY', 'BROKEN'] as const).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: StatusColors[s] }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              {STATUS_LABEL[s]} {chargers ? counts[s] : ''}
            </Text>
          </View>
        ))}
      </View>

      {error && !chargers ? (
        <ErrorState message={error} onRetry={load} />
      ) : view === 'map' ? (
        <View style={styles.mapWrap}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: center.lat,
              longitude: center.lng,
              latitudeDelta: 0.2,
              longitudeDelta: 0.2,
            }}
            onPress={() => setSelectedId(null)}
            toolbarEnabled={false}>
            {chargers?.map((c) => (
              <MapPin
                key={`${c.id}-${c.status}-${c.id === selectedId}`}
                lat={c.lat}
                lng={c.lng}
                color={StatusColors[c.status]}
                icon="ev-station"
                selected={c.id === selectedId}
                onPress={() => setSelectedId(c.id)}
                accessibilityLabel={`${c.name}, ${STATUS_LABEL[c.status]}`}
              />
            ))}
          </MapView>
          {selected && (
            <View style={styles.sheet}>
              <ChargerRow charger={selected} onPress={() => openDetail(selected.id)} />
              <Button
                label="View details & report"
                icon="chevron-right"
                onPress={() => openDetail(selected.id)}
              />
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={chargers ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ChargerRow charger={item} onPress={() => openDetail(item.id)} />
          )}
          ListEmptyComponent={
            chargers ? (
              <EmptyState
                icon="ev-plug-type2"
                title="No chargers match"
                message="Try another connector or a lower power filter."
              />
            ) : (
              <View style={{ gap: Spacing.sm }}>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  toggle: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  divider: { width: 1, height: 24, marginHorizontal: Spacing.xs },
  legend: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, fontWeight: '600' },
  mapWrap: { flex: 1, overflow: 'hidden' },
  sheet: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.md,
    gap: Spacing.sm,
  },
  list: { padding: Spacing.md, gap: Spacing.sm },
});
