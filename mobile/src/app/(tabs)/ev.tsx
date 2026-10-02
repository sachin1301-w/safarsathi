import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChargerRow } from '@/components/charger-row';
import { DemoFooter } from '@/components/demo-footer';
import { LeafletMap } from '@/components/leaflet-map';
import { FullScreenLoader } from '@/components/travel-loader';
import { Button, Chip, EmptyState, ErrorState, FadeIn, Icon, SkeletonCard } from '@/components/ui';
import { Radius, Spacing, StatusColors, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { DEFAULT_CENTER, useApp } from '@/lib/app-context';
import { useT } from '@/lib/i18n';
import { useLocation } from '@/lib/location';
import type { Charger, ChargerStatus } from '@/lib/types';

const CONNECTORS = ['All', 'CCS2', 'Type2', 'GBT', 'Bharat AC001', 'CHAdeMO'];
// Wide enough for the highway chargers towards Mahabaleshwar, Lonavala and Mumbai.
const RADIUS_KM = 300;
/** The map opens zoomed to this many of the closest chargers. */
const FOCUS_COUNT = 6;

const POWER = [
  { label: 'Any kW', minKw: undefined },
  { label: '22+ kW', minKw: 22 },
  { label: '50+ kW', minKw: 50 },
];

export default function EvScreen() {
  const theme = useTheme();
  const t = useT();
  const { profile } = useApp();
  const location = useLocation();
  // Centre on the user when they're in India, else on their home.
  const center = (location.covered && location.coords) || profile?.home || DEFAULT_CENTER;

  const [connector, setConnector] = useState('All');
  const [minKw, setMinKw] = useState<number | undefined>(undefined);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [chargers, setChargers] = useState<Charger[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Which search the shown results belong to; differs from reqKey while a new one loads.
  const reqKey = `${center.lat},${center.lng},${connector},${minKw}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .chargers({
        lat: center.lat,
        lng: center.lng,
        radiusKm: RADIUS_KM,
        connector: connector === 'All' ? undefined : connector,
        minKw,
      })
      .then((list) => {
        setChargers(list);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadedKey(reqKey));
  }, [center.lat, center.lng, connector, minKw, reqKey]);

  // Reload whenever the tab regains focus, so a report made on the detail screen shows at once.
  useFocusEffect(load);

  const counts = useMemo(() => {
    const c: Record<ChargerStatus, number> = { WORKING: 0, BUSY: 0, BROKEN: 0, UNKNOWN: 0 };
    chargers?.forEach((ch) => c[ch.status]++);
    return c;
  }, [chargers]);

  // Results come sorted by distance; zoom to the closest ones so their pins are in view.
  const focus = useMemo(
    () => (chargers?.length ? [center, ...chargers.slice(0, FOCUS_COUNT)] : undefined),
    [chargers, center],
  );

  const selected = chargers?.find((c) => c.id === selectedId) ?? null;
  const openDetail = (id: string) => router.push({ pathname: '/charger/[id]', params: { id } });

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>{t('ev.title')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('ev.subtitle')}</Text>
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
        style={styles.filterBar}
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
              {t(`charger.${s}`)} {chargers ? counts[s] : ''}
            </Text>
          </View>
        ))}
      </View>

      {error && !chargers ? (
        <ErrorState message={error} onRetry={load} />
      ) : view === 'map' ? (
        <View style={styles.mapWrap}>
          <LeafletMap
            style={StyleSheet.absoluteFill}
            center={center}
            zoom={12}
            focus={focus}
            user={location.coords}
            markers={(chargers ?? []).map((c) => ({
              id: c.id,
              lat: c.lat,
              lng: c.lng,
              color: StatusColors[c.status],
              glyph: 'ev' as const,
              selected: c.id === selectedId,
            }))}
            onMarkerPress={setSelectedId}
            onMapPress={() => setSelectedId(null)}
          />
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
          renderItem={({ item, index }) => (
            <FadeIn delay={Math.min(index, 8) * 40}>
              <ChargerRow charger={item} onPress={() => openDetail(item.id)} />
            </FadeIn>
          )}
          ListFooterComponent={<DemoFooter />}
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
      <FullScreenLoader
        visible={loadedKey !== reqKey}
        vehicles={['ev', 'car']}
        title={t('ev.finding')}
        subtitle="Checking live status and connectors near you"
      />
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
  // Horizontal ScrollViews grow to fill the column on Android unless told not to.
  filterBar: { flexGrow: 0 },
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
