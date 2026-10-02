import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DemoFooter } from '@/components/demo-footer';
import { LeafletMap } from '@/components/leaflet-map';
import { ParkingScene } from '@/components/scenes';
import { FullScreenLoader } from '@/components/travel-loader';
import { PlaceSearch } from '@/components/place-search';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  FadeIn,
  Icon,
  SkeletonCard,
  type IconName,
} from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { DEFAULT_CENTER, useApp } from '@/lib/app-context';
import { formatInr, formatKm, formatRate, formatTime } from '@/lib/format';
import { useT, type StringKey } from '@/lib/i18n';
import { useLocation } from '@/lib/location';
import type { ParkingLot, Place } from '@/lib/types';

const ARRIVAL_OPTIONS: { label: StringKey; offsetMins: number }[] = [
  { label: 'parking.now', offsetMins: 0 },
  { label: 'parking.in1h', offsetMins: 60 },
  { label: 'parking.in3h', offsetMins: 180 },
];
const HOURS = [1, 2, 3, 4];
const RADIUS_KM = 15;
/** With nothing within RADIUS_KM, show this many of the nearest lots instead. */
const FALLBACK_COUNT = 5;

const TYPE_ICON: Record<ParkingLot['type'], IconName> = {
  MALL: 'shopping',
  STATION: 'train',
  AIRPORT: 'airplane',
  STREET: 'road-variant',
  MULTILEVEL: 'garage',
};

function availabilityColor(lot: ParkingLot) {
  const ratio = (lot.predictedFreeSpots ?? 0) / lot.totalSpots;
  if (ratio > 0.3) return '#22C55E';
  if (ratio > 0.1) return '#F59E0B';
  return '#EF4444';
}

export default function ParkingScreen() {
  const theme = useTheme();
  const t = useT();
  const { profile } = useApp();
  const location = useLocation();

  const [destination, setDestination] = useState<Place | null>(null);
  const [offsetMins, setOffsetMins] = useState(0);
  const [lots, setLots] = useState<ParkingLot[] | null>(null);
  // True when nothing was within RADIUS_KM and `lots` holds the nearest ones instead.
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ParkingLot | null>(null);
  const [reserving, setReserving] = useState<{ lot: ParkingLot; arriveAt: Date } | null>(null);

  // A searched destination, else where the user is (in India), else home.
  const here = location.covered ? location.coords : null;
  const center = destination ?? here ?? profile?.home ?? DEFAULT_CENTER;
  const centerName = destination?.name ?? (here ? 'you' : (profile?.home?.name ?? 'Kothrud'));

  // Which search the shown lots belong to; differs from reqKey while a new one loads.
  const reqKey = `${center.lat},${center.lng},${offsetMins}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const load = useCallback(() => {
    const query = (radiusKm: number) =>
      api.parking({
        lat: center.lat,
        lng: center.lng,
        radiusKm,
        arriveAt: new Date(Date.now() + offsetMins * 60_000).toISOString(),
      });
    query(RADIUS_KM)
      .then(async (near) => {
        const far = near.length ? null : (await query(500)).slice(0, FALLBACK_COUNT);
        setLots(far ?? near);
        setFallback(!!far?.length);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadedKey(reqKey));
  }, [center.lat, center.lng, offsetMins, reqKey]);

  // Zoom the map to the closest lots (and the search point) so the pins are in view.
  const focus = useMemo(
    () => (lots?.length ? [center, ...lots.slice(0, FALLBACK_COUNT)] : undefined),
    [lots, center],
  );

  useEffect(load, [load]);

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{t('parking.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t('parking.subtitle')}
        </Text>
      </View>
      <View style={styles.searchWrap}>
        <PlaceSearch
          value={destination}
          onSelect={setDestination}
          placeholder={t('parking.search')}
        />
        <View style={styles.nearRow}>
          <Icon name="map-marker-radius" size={16} color={theme.accent} />
          <Text style={{ color: theme.textSecondary, flex: 1 }} numberOfLines={1}>
            {fallback
              ? `Nothing within ${RADIUS_KM} km of ${centerName}, showing the nearest`
              : `Parking within ${RADIUS_KM} km of ${centerName}`}
          </Text>
          {destination && here && (
            <Chip label="Near me" icon="crosshairs-gps" onPress={() => setDestination(null)} />
          )}
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipBar}
        contentContainerStyle={styles.chips}>
        {ARRIVAL_OPTIONS.map((o) => (
          <Chip
            key={o.label}
            label={t(o.label)}
            icon="clock-outline"
            selected={offsetMins === o.offsetMins}
            onPress={() => setOffsetMins(o.offsetMins)}
          />
        ))}
      </ScrollView>

      <View style={styles.mapWrap}>
        <LeafletMap
          style={StyleSheet.absoluteFill}
          center={center}
          zoom={14}
          focus={focus}
          user={location.coords}
          markers={(lots ?? []).map((lot) => ({
            id: lot.id,
            lat: lot.lat,
            lng: lot.lng,
            color: availabilityColor(lot),
            glyph: 'parking' as const,
            label: `${lot.predictedFreeSpots}`,
            selected: lot.id === selected?.id,
          }))}
          onMarkerPress={(id) => setSelected(lots?.find((l) => l.id === id) ?? null)}
          onMapPress={() => setSelected(null)}
        />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !lots ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : lots.length === 0 ? (
          <EmptyState
            icon="parking"
            title="No parking found"
            message="Try a nearby landmark, mall or station."
          />
        ) : (
          [...lots]
            .sort((a, b) => (a.id === selected?.id ? -1 : b.id === selected?.id ? 1 : 0))
            .map((lot, i) => (
              <FadeIn key={lot.id} delay={Math.min(i, 8) * 40}>
                <LotCard
                  lot={lot}
                  highlighted={lot.id === selected?.id}
                  onPress={() => setSelected(lot)}
                  onReserve={() =>
                    setReserving({ lot, arriveAt: new Date(Date.now() + offsetMins * 60_000) })
                  }
                />
              </FadeIn>
            ))
        )}
        <DemoFooter />
      </ScrollView>

      <ReserveSheet
        lot={reserving?.lot ?? null}
        arriveAt={reserving?.arriveAt ?? null}
        onClose={() => setReserving(null)}
      />
      <FullScreenLoader
        visible={loadedKey !== reqKey}
        scene={<ParkingScene />}
        title={t('parking.finding')}
        subtitle="Predicting free spots for your arrival time"
      />
    </SafeAreaView>
  );
}

function LotCard({
  lot,
  highlighted,
  onPress,
  onReserve,
}: {
  lot: ParkingLot;
  highlighted: boolean;
  onPress: () => void;
  onReserve: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const free = lot.predictedFreeSpots ?? 0;
  const color = availabilityColor(lot);
  return (
    <Card onPress={onPress} style={highlighted && { borderColor: theme.accent, borderWidth: 2 }}>
      <View style={styles.lotTop}>
        <View style={[styles.lotIcon, { backgroundColor: theme.accentSoft }]}>
          <Icon name={TYPE_ICON[lot.type]} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.lotName, { color: theme.text }]} numberOfLines={1}>
            {lot.name}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {lot.distanceKm !== undefined ? `${formatKm(lot.distanceKm)} · ` : ''}
            {formatRate(lot.ratePerHour)}
            {lot.hasEvCharging ? ' · EV charging' : ''}
          </Text>
        </View>
        <Badge label={`${free} ${t('parking.free')}`} color={color} />
      </View>
      <View style={[styles.bar, { backgroundColor: theme.surfaceAlt }]}>
        <View
          style={[
            styles.barFill,
            { backgroundColor: color, width: `${(free / lot.totalSpots) * 100}%` },
          ]}
        />
      </View>
      <View style={styles.lotBottom}>
        <Text style={[styles.spots, { color: theme.textSecondary }]}>
          {lot.estimated ? '~' : ''}
          {free} of {lot.estimated ? '~' : ''}
          {lot.totalSpots} spots predicted free{lot.estimated ? ' (estimate)' : ''}
        </Text>
        <Button
          label={t('parking.reserve')}
          icon="calendar-check"
          onPress={onReserve}
          disabled={free === 0}
          style={styles.reserve}
        />
      </View>
    </Card>
  );
}

function ReserveSheet({
  lot,
  arriveAt,
  onClose,
}: {
  lot: ParkingLot | null;
  arriveAt: Date | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [hours, setHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ reservationId: string; amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  async function confirm() {
    if (!lot || !arriveAt) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.reserveParking(lot.id, arriveAt.toISOString(), hours));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={lot !== null} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          {result ? (
            <>
              <View style={[styles.successIcon, { backgroundColor: theme.accentSoft }]}>
                <Icon name="check-bold" size={32} color={theme.accent} />
              </View>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Spot reserved</Text>
              <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
                {lot?.name} from {arriveAt ? formatTime(arriveAt.toISOString()) : ''} for {hours} h
              </Text>
              <Text style={[styles.reservationId, { color: theme.text }]}>
                {result.reservationId}
              </Text>
              <Text style={{ color: theme.textSecondary }}>
                Pay {formatInr(result.amount)} at the gate (demo)
              </Text>
              <Button label="Done" onPress={close} style={{ alignSelf: 'stretch' }} />
            </>
          ) : (
            <>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Reserve at {lot?.name}</Text>
              <Text style={{ color: theme.textSecondary }}>
                Arriving {arriveAt ? formatTime(arriveAt.toISOString()) : ''}. How long?
              </Text>
              <View style={styles.hours}>
                {HOURS.map((h) => (
                  <Chip
                    key={h}
                    label={`${h} h`}
                    selected={hours === h}
                    onPress={() => setHours(h)}
                  />
                ))}
              </View>
              {lot && (
                <Text style={[styles.total, { color: theme.text }]}>
                  {lot.ratePerHour < 0
                    ? 'Pay at the lot (rate not listed)'
                    : `Total ${formatInr(lot.ratePerHour * hours)}`}
                </Text>
              )}
              {error && <Text style={{ color: theme.danger }}>{error}</Text>}
              <View style={styles.sheetButtons}>
                <Button label="Cancel" variant="secondary" onPress={close} style={{ flex: 1 }} />
                <Button label="Confirm" onPress={confirm} loading={busy} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  searchWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, zIndex: 10 },
  // Horizontal ScrollViews grow to fill the column on Android unless told not to.
  chipBar: { flexGrow: 0 },
  nearRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  chips: { gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  mapWrap: {
    height: 220,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  list: { flex: 1 },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xl * 2, gap: Spacing.sm },
  lotTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  lotIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lotName: { fontSize: 16, fontWeight: '700' },
  bar: { height: 6, borderRadius: 3, marginTop: Spacing.md, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  lotBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  // The text wraps; the button keeps its full size.
  spots: { flex: 1, fontSize: 13 },
  reserve: { minHeight: 42, paddingHorizontal: Spacing.md, flexShrink: 0 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'center',
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  hours: { flexDirection: 'row', gap: Spacing.sm },
  total: { fontSize: 18, fontWeight: '700' },
  sheetButtons: { flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch' },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reservationId: { fontSize: 28, fontWeight: '800', letterSpacing: 2 },
});
