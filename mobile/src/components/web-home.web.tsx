/**
 * The website's Home: a cinematic page over the 3D journey scene. Scrolling flies the camera down
 * the highway while sections fade in: the hero title, "Start your journey" cards (plan, EV,
 * parking), "Why SafarSathi" features with counting stats, and your live alerts and next trip.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';

import { AlertBanner } from '@/components/alert-banner';
import { CinematicScene } from '@/components/cinematic-scene';
import { DemoFooter } from '@/components/demo-footer';
import { JourneyCard } from '@/components/journey-card';
import { Button, Card, Chip, Icon, webData, type IconName } from '@/components/ui';
import { CHROME_INSETS } from '@/components/web-chrome';
import { Radius, Spacing, StatusColors, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAlerts } from '@/lib/alerts';
import { useAppColorScheme } from '@/lib/theme-preference';
import { useApp } from '@/lib/app-context';
import type { Trip } from '@/lib/types';

/** Gold accents: bright on the dark scene, deeper in light mode so they stay readable. */
const useGold = () => (useAppColorScheme() === 'dark' ? '#E9B949' : '#A87410');
/** data-reveal with a stagger step (0-3), styled in app/+html.tsx. */
const reveal = (step = 0) => ({ dataSet: { reveal: '', revealDelay: String(step) } }) as object;

function useCountUp(target: number, start: boolean, ms = 1600) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, start, ms]);
  return n;
}

export function WebHome() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const { profile } = useApp();
  const { alerts, dismiss } = useAlerts();
  // Scroll position 0..1, read by the 3D scene every frame (no re-render).
  const progress = useRef(0);
  const scroller = useRef<ScrollView>(null);
  // Veil over the 3D scene that deepens once you scroll past the hero, so text stays readable.
  const veil = useRef<View>(null);
  const [query, setQuery] = useState('');
  const [statsSeen, setStatsSeen] = useState(false);
  const [nextTrip, setNextTrip] = useState<Trip | null>(null);
  const big = width >= 1200;
  const gold = useGold();

  useFocusEffect(
    useCallback(() => {
      api
        .trips()
        .then((trips) => {
          const now = Date.now();
          const active = trips
            .filter((t) => ['BOOKED', 'IN_PROGRESS', 'DISRUPTED'].includes(t.status))
            .filter((t) => new Date(t.legs[t.legs.length - 1].arriveAt).getTime() > now)
            .sort((a, b) => +new Date(a.legs[0].departAt) - +new Date(b.legs[0].departAt));
          setNextTrip(active[0] ?? null);
        })
        .catch(() => undefined);
    }, []),
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = Math.max(1, contentSize.height - layoutMeasurement.height);
    progress.current = contentOffset.y / max;
    const el = veil.current as unknown as HTMLElement | null;
    if (el) el.style.opacity = String(Math.min(0.78, Math.max(0, contentOffset.y / layoutMeasurement.height - 0.15) * 0.9));
    if (!statsSeen && contentOffset.y > layoutMeasurement.height * 0.9) setStatsSeen(true);
  };

  const ask = () => {
    if (!query.trim()) return router.navigate('/chat');
    router.navigate({ pathname: '/chat', params: { q: query.trim(), n: String(Date.now()) } });
    setQuery('');
  };

  const heroHeight = Math.max(560, height - CHROME_INSETS.top - 10);

  return (
    <View style={styles.root}>
      <CinematicScene progress={progress} />
      <View
        ref={veil}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { position: 'fixed', opacity: 0, backgroundColor: theme.background } as unknown as ViewStyle,
        ]}
      />
      <ScrollView
        ref={scroller}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}>
        {/* ---------- Hero ---------- */}
        <View style={[styles.hero, { minHeight: heroHeight }]}>
          <Text style={[styles.kicker, { color: gold }]} {...webData('display')}>
            INDIA&apos;S AI MOBILITY COPILOT
          </Text>
          <Text
            style={[
              styles.title,
              // Sized to fit: the title is wide (Orbitron, letter-spaced).
              big
                ? { fontSize: 104 }
                : width >= 700
                  ? { fontSize: 72 }
                  : { fontSize: Math.max(28, (width - 40) / 9.5), letterSpacing: 2 },
            ]}
            {...({ dataSet: { display: '', gradientText: '', titleGlow: '' } } as object)}>
            SAFARSATHI
          </Text>
          <Text style={[styles.modes, { color: '#F4F1FF' }]} {...webData('display')}>
            METRO · BUS · TRAIN · FLIGHT · CAB · EV
          </Text>
          <Text style={styles.tagline}>One copilot. Your whole journey.</Text>
          <View style={styles.heroCtas}>
            <View {...webData('glowButton')} style={styles.ctaWrap}>
              <Button
                label="Plan a trip"
                icon="map-marker-path"
                onPress={() => router.navigate('/chat')}
              />
            </View>
            <Button
              label="Explore"
              icon="chevron-double-down"
              variant="secondary"
              onPress={() => scroller.current?.scrollTo({ y: heroHeight - 40, animated: true })}
            />
          </View>
          <View style={styles.scrollCue}>
            <Text style={styles.scrollText} {...webData('display')}>
              SCROLL
            </Text>
            <View style={styles.cueTrack}>
              <View style={styles.cueDot} {...webData('scrollCue')} />
            </View>
          </View>
        </View>

        {/* ---------- Start your journey ---------- */}
        <View style={styles.section}>
          <SectionHeading eyebrow="START YOUR JOURNEY" title="Where are you headed today?" />
          <View style={[styles.cards, big && styles.cardsRow]}>
            <View style={[styles.cardCol, big && { flex: 1.25 }]} {...reveal(0)}>
              <Card style={styles.hudCard}>
                <FrameTitle icon="map-marker-path" title="Plan a trip" />
                <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                  Tell the copilot where and when. It compares autos, metro, buses, trains, flights
                  and cabs, door to door.
                </Text>
                <View
                  style={[
                    styles.search,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                  <Icon name="magnify" size={22} color={theme.accent} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={ask}
                    placeholder="Kothrud to Connaught Place by 8 PM…"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.searchInput, { color: theme.text }]}
                  />
                  <Pressable
                    onPress={ask}
                    accessibilityRole="button"
                    accessibilityLabel="Ask"
                    style={[styles.go, { backgroundColor: theme.accent }]}>
                    <Icon name="arrow-right" size={22} color={theme.onAccent} />
                  </Pressable>
                </View>
                <View style={styles.chips}>
                  {['Pune → Delhi by 8 PM', 'EV trip to Mahabaleshwar', 'Pune to Bikaner'].map(
                    (q) => (
                      <Chip
                        key={q}
                        label={q}
                        onPress={() =>
                          router.navigate({
                            pathname: '/chat',
                            params: { q, n: String(Date.now()) },
                          })
                        }
                      />
                    ),
                  )}
                </View>
              </Card>
            </View>
            <View style={styles.cardCol} {...reveal(1)}>
              <Card style={styles.hudCard} onPress={() => router.navigate('/ev')}>
                <FrameTitle icon="ev-station" title="EV chargers" />
                <Text style={[styles.bigNumber, { color: theme.text }]}>640+</Text>
                <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                  Live status from operators and drivers, across India.
                </Text>
                <View style={styles.legend}>
                  {(['WORKING', 'BUSY', 'BROKEN'] as const).map((s) => (
                    <View key={s} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: StatusColors[s] }]} />
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        {s[0] + s.slice(1).toLowerCase()}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.link}>Open charger map →</Text>
              </Card>
            </View>
            <View style={styles.cardCol} {...reveal(2)}>
              <Card style={styles.hudCard} onPress={() => router.navigate('/parking')}>
                <FrameTitle icon="parking" title="Smart parking" />
                <Text style={[styles.bigNumber, { color: theme.text }]}>2,400+</Text>
                <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                  Predicted free spots when you arrive, with one-tap reserve and directions.
                </Text>
                <Text style={styles.link}>Find parking →</Text>
              </Card>
            </View>
          </View>
        </View>

        {/* ---------- Why SafarSathi ---------- */}
        <View style={styles.section}>
          <SectionHeading eyebrow="WHY SAFARSATHI" title="One copilot for every leg" />
          <View style={styles.features}>
            {FEATURES.map((f, i) => (
              <View key={f.title} style={styles.feature} {...reveal(i % 4)}>
                <Card style={styles.featureCard}>
                  <View style={[styles.featureIcon, { backgroundColor: theme.accentSoft }]}>
                    <Icon name={f.icon} size={26} color={theme.accent} />
                  </View>
                  <Text style={[styles.featureTitle, { color: theme.text }]}>{f.title}</Text>
                  <Text style={[styles.cardText, { color: theme.textSecondary }]}>{f.text}</Text>
                </Card>
              </View>
            ))}
          </View>
          <View style={styles.stats} {...reveal(1)}>
            <Stat value={640} suffix="+" label="EV chargers" start={statsSeen} />
            <Stat value={2400} suffix="+" label="Parking lots" start={statsSeen} />
            <Stat value={44} label="Cities" start={statsSeen} />
            <Stat value={11} label="Languages" start={statsSeen} />
          </View>
        </View>

        {/* ---------- Your trips ---------- */}
        <View style={[styles.section, styles.mine]}>
          <SectionHeading
            eyebrow="YOUR JOURNEYS"
            title={profile ? `Welcome back, ${profile.name}` : 'Welcome back'}
          />
          <View style={{ gap: Spacing.md }} {...reveal(0)}>
            {alerts.map((a) => (
              <AlertBanner
                key={a.tripId}
                alert={a}
                onDismiss={a.broken ? undefined : () => dismiss(a.tripId)}
              />
            ))}
            {nextTrip ? (
              <JourneyCard
                itinerary={{
                  ...nextTrip,
                  label: nextTrip.option,
                  badges: [nextTrip.option],
                  arriveBy: nextTrip.arriveBy ?? undefined,
                }}
                onPress={() =>
                  router.push({ pathname: '/journey/[id]', params: { id: nextTrip.id } })
                }
              />
            ) : (
              <Card style={styles.empty}>
                <Icon name="ticket-confirmation-outline" size={28} color={theme.accent} />
                <Text style={[styles.cardText, { color: theme.textSecondary, flex: 1 }]}>
                  No upcoming trips yet. Plan one above and tap Book all.
                </Text>
                <Button
                  label="My trips"
                  variant="secondary"
                  onPress={() => router.navigate('/trips')}
                />
              </Card>
            )}
          </View>
          <DemoFooter />
        </View>
      </ScrollView>
    </View>
  );
}

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'bell-ring-outline',
    title: 'Live delay alerts',
    text: 'A delay anywhere in your trip triggers an alert and a new on-time plan in one tap.',
  },
  {
    icon: 'ticket-confirmation-outline',
    title: 'Book all in one tap',
    text: 'Trains, flights, buses, metro and cabs: every ticket in one place.',
  },
  {
    icon: 'translate',
    title: '11 Indian languages',
    text: 'Type or speak in Hindi, Marathi, Tamil, Bengali and more; replies are read aloud.',
  },
  {
    icon: 'leaf',
    title: 'Green score',
    text: 'See the CO₂ you save on every trip compared with driving alone.',
  },
];

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  const theme = useTheme();
  const gold = useGold();
  return (
    <View style={styles.heading} {...reveal(0)}>
      <Text style={[styles.eyebrow, { color: gold }]} {...webData('display')}>
        {eyebrow}
      </Text>
      <Text style={[styles.h2, { color: theme.text }]}>{title}</Text>
    </View>
  );
}

function FrameTitle({ icon, title }: { icon: IconName; title: string }) {
  const gold = useGold();
  return (
    <View style={styles.frameTitle}>
      <Icon name={icon} size={22} color={gold} />
      <Text style={[styles.frameTitleText, { color: gold }]}>{title}</Text>
    </View>
  );
}

function Stat({
  value,
  suffix = '',
  label,
  start,
}: {
  value: number;
  suffix?: string;
  label: string;
  start: boolean;
}) {
  const theme = useTheme();
  const n = useCountUp(value, start);
  return (
    <Card style={styles.stat}>
      <Text style={styles.statValue} {...webData('gradientText')}>
        {n.toLocaleString('en-IN')}
        {suffix}
      </Text>
      <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  hero: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  kicker: { fontSize: 14, fontWeight: '800', letterSpacing: 6 },
  title: { fontWeight: '900', textAlign: 'center', letterSpacing: 6 },
  modes: {
    fontSize: 13,
    letterSpacing: 5,
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,.6)',
    textShadowRadius: 8,
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: 22,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,.6)',
    textShadowRadius: 10,
  },
  heroCtas: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  ctaWrap: { borderRadius: Radius.md },
  scrollCue: { position: 'absolute', bottom: 18, alignItems: 'center', gap: 8 },
  scrollText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 4, fontWeight: '800' },
  cueTrack: {
    width: 2,
    height: 40,
    backgroundColor: 'rgba(255,255,255,.25)',
    overflow: 'hidden',
    alignItems: 'center',
  },
  cueDot: { width: 2, height: 14, backgroundColor: '#FFFFFF' },
  section: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    paddingVertical: 70,
    gap: Spacing.lg,
  },
  heading: { alignItems: 'center', gap: 8 },
  eyebrow: { fontSize: 13, letterSpacing: 6, fontWeight: '800' },
  h2: { fontSize: 38, fontWeight: '800', textAlign: 'center' },
  cards: { gap: Spacing.lg },
  cardsRow: { flexDirection: 'row', alignItems: 'stretch' },
  cardCol: { flex: 1 },
  hudCard: { flex: 1, padding: 26, gap: 14, minHeight: 300 },
  frameTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  frameTitleText: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  cardText: { fontSize: 15, lineHeight: 22 },
  bigNumber: { fontSize: 46, fontWeight: '900' },
  link: { color: '#00BFA6', fontWeight: '800', marginTop: 'auto' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 56,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 12 },
  go: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  feature: { flexGrow: 1, flexBasis: 260 },
  featureCard: { padding: 24, gap: 10, minHeight: 200 },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: { fontSize: 19, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'center' },
  stat: { minWidth: 200, flexGrow: 1, alignItems: 'center', paddingVertical: 22, gap: 4 },
  statValue: { fontSize: 40, fontWeight: '900' },
  mine: { maxWidth: 900 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: 22 },
});
