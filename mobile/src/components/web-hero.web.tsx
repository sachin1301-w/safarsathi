/**
 * Website Home hero: headline with animated gradient, call-to-action buttons, counting stats and
 * the floating 3D globe. Side by side on wide screens, stacked on narrow ones.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { HeroGlobe } from '@/components/hero-globe';
import { Button, FadeIn, Icon, webData } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';

const STATS: [number, string, string][] = [
  [640, '+', 'EV chargers'],
  [2400, '+', 'parking lots'],
  [44, '', 'cities'],
  [11, '', 'languages'],
];

/** Counts up from 0 once, with an ease-out. */
function useCountUp(target: number, ms = 1600) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

function Stat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const theme = useTheme();
  const n = useCountUp(value);
  return (
    <View
      style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}
      {...webData('tilt')}>
      <Text style={styles.statValue} {...webData('gradientText')}>
        {n.toLocaleString('en-IN')}
        {suffix}
      </Text>
      <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function WebHero({ onPlan }: { onPlan: () => void }) {
  const theme = useTheme();
  const wide = useWindowDimensions().width >= 1100;
  return (
    <View style={[styles.wrap, wide && styles.wrapWide]}>
      <FadeIn style={[styles.copy, wide && { flex: 1.1 }]}>
        <View
          style={[styles.kicker, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
          <Icon name="creation" size={16} color={theme.accent} />
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
            AI mobility copilot for India
          </Text>
        </View>
        <Text style={[styles.h1, { color: theme.text }]}>Your whole journey.</Text>
        <Text style={styles.h1} {...webData('gradientText')}>
          One AI copilot.
        </Text>
        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          Metro, bus, auto, train, flight, cab and your EV, planned door to door, booked in one
          place and re-planned the moment something is late. In 11 Indian languages.
        </Text>
        <View style={styles.ctas}>
          <View {...webData('glowButton')} style={styles.ctaWrap}>
            <Button label="Plan a trip" icon="map-marker-path" onPress={onPlan} />
          </View>
          <Button
            label="EV chargers"
            icon="ev-station"
            variant="secondary"
            onPress={() => router.navigate('/ev')}
          />
          <Button
            label="Parking"
            icon="parking"
            variant="secondary"
            onPress={() => router.navigate('/parking')}
          />
        </View>
        <View style={styles.stats}>
          {STATS.map(([v, s, l]) => (
            <Stat key={l} value={v} suffix={s} label={l} />
          ))}
        </View>
      </FadeIn>
      <FadeIn delay={150} style={[styles.globeWrap, wide && { flex: 1 }]}>
        <View {...webData('float')} style={styles.globeFloat}>
          <HeroGlobe />
        </View>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg, paddingVertical: Spacing.md },
  wrapWide: { flexDirection: 'row-reverse', alignItems: 'center' },
  copy: { gap: Spacing.md },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  h1: { fontSize: 52, lineHeight: 58, fontWeight: '900', letterSpacing: -1 },
  lead: { fontSize: 18, lineHeight: 28, maxWidth: 560 },
  ctas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  ctaWrap: { borderRadius: Radius.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  stat: {
    minWidth: 112,
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  statValue: { fontSize: 26, fontWeight: '900' },
  globeWrap: { alignItems: 'center', justifyContent: 'center' },
  globeFloat: { width: '100%', alignItems: 'center' },
});
