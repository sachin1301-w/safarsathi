/**
 * Startup screen: a bus drives in from the left, keeps running in the middle of the screen
 * (bobbing, road and trees streaming past) until the backend answers, then drives off.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { api } from '@/lib/api';

const ARRIVE_MS = 1300;
/** After this long without the backend, explain what the app is waiting for. */
const SLOW_MS = 8000;
const DASH_W = 34;
const DASH_GAP = 26;

export function BootScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [busX] = useState(() => new Animated.Value(-width / 2 - 120));
  const [bob] = useState(() => new Animated.Value(0));
  const [road] = useState(() => new Animated.Value(0));
  const [trees] = useState(() => new Animated.Value(0));
  const [speed] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [arrived, setArrived] = useState(false);
  const [slow, setSlow] = useState(false);

  // Drive in, then keep "running" on the spot.
  useEffect(() => {
    Animated.timing(busX, {
      toValue: 0,
      duration: ARRIVE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setArrived(true));
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: -4, duration: 180, useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.timing(road, {
          toValue: 1,
          duration: 450,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.timing(trees, {
          toValue: 1,
          duration: 2600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(speed, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(speed, { toValue: 0.3, duration: 220, useNativeDriver: true }),
        ]),
      ),
    ];
    loops.forEach((l) => l.start());
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      loops.forEach((l) => l.stop());
      clearTimeout(timer);
    };
  }, [busX, bob, road, trees, speed]);

  // Once the backend is up and the bus has arrived: drive off and fade into the app.
  useEffect(() => {
    if (!ready || !arrived) return;
    Animated.parallel([
      Animated.timing(busX, {
        toValue: width / 2 + 160,
        duration: 650,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, { toValue: 0, duration: 450, delay: 350, useNativeDriver: true }),
    ]).start(onDone);
  }, [ready, arrived, busX, fade, width, onDone]);

  const dashCount = Math.ceil(width / (DASH_W + DASH_GAP)) + 2;
  const accent = theme.accent;

  return (
    <Animated.View style={[styles.wrap, { backgroundColor: theme.background, opacity: fade }]}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: accent }]}>
          <Icon name="map-marker-path" size={30} color={theme.onAccent} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>SafarSathi</Text>
        <Text style={[styles.tagline, { color: theme.textSecondary }]}>
          Your travel companion across India
        </Text>
      </View>

      <View style={styles.scene}>
        {/* Trees stream past behind the bus (parallax). */}
        <Animated.View
          style={[
            styles.trees,
            {
              width: width * 2,
              transform: [
                { translateX: trees.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) },
              ],
            },
          ]}>
          {Array.from({ length: 8 }, (_, i) => (
            <Icon
              key={i}
              name={i % 3 === 1 ? 'office-building' : 'pine-tree'}
              size={i % 3 === 1 ? 34 : 28}
              color={theme.muted}
            />
          ))}
        </Animated.View>

        <Animated.View
          style={[styles.bus, { transform: [{ translateX: busX }, { translateY: bob }] }]}>
          <View style={styles.speedLines}>
            {[18, 30, 22].map((w, i) => (
              <Animated.View
                key={i}
                style={[styles.speedLine, { width: w, backgroundColor: accent, opacity: speed }]}
              />
            ))}
          </View>
          <Icon name="bus-side" size={92} color={accent} />
        </Animated.View>

        <View style={[styles.road, { backgroundColor: theme.text }]}>
          <Animated.View
            style={[
              styles.dashes,
              {
                transform: [
                  {
                    translateX: road.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -(DASH_W + DASH_GAP)],
                    }),
                  },
                ],
              },
            ]}>
            {Array.from({ length: dashCount }, (_, i) => (
              <View key={i} style={[styles.dash, { backgroundColor: theme.background }]} />
            ))}
          </Animated.View>
        </View>
      </View>

      <View style={styles.status}>
        <Text style={[styles.statusText, { color: theme.textSecondary }]}>
          {ready ? 'Ready!' : 'Connecting to SafarSathi…'}
        </Text>
        {slow && !ready && (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Still waiting for the server at {api.baseUrl}. Make sure the backend (npm run dev) is
            running on the laptop that runs Expo.
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 6, marginBottom: 48 },
  logo: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', marginTop: 8 },
  tagline: { fontSize: 15 },
  scene: { height: 170, justifyContent: 'flex-end', overflow: 'hidden' },
  trees: {
    position: 'absolute',
    bottom: 34,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  bus: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: -14, // wheels sit on the road
    zIndex: 2,
  },
  speedLines: { gap: 8, marginRight: 4, alignItems: 'flex-end' },
  speedLine: { height: 3, borderRadius: 2 },
  road: { height: 30, justifyContent: 'center', overflow: 'hidden' },
  dashes: { flexDirection: 'row', gap: DASH_GAP },
  dash: { width: DASH_W, height: 4, borderRadius: 2 },
  status: { alignItems: 'center', marginTop: 36, paddingHorizontal: 32, gap: 8 },
  statusText: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, textAlign: 'center' },
});
