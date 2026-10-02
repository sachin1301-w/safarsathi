/**
 * Loading scene in the style of the boot screen: a vehicle drives in, keeps running in place
 * with scenery streaming past, and (with several vehicles) hands over to the next one.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/constants/theme';

export type Vehicle = 'bus' | 'car' | 'ev' | 'rickshaw' | 'train' | 'plane';

const ICONS: Record<Vehicle, IconName> = {
  bus: 'bus-side',
  car: 'car-side',
  ev: 'car-electric',
  rickshaw: 'rickshaw',
  train: 'train-car-passenger',
  plane: 'airplane',
};

const SIZES = {
  sm: { height: 54, icon: 30, road: 10, dash: 12 },
  md: { height: 112, icon: 64, road: 20, dash: 26 },
  lg: { height: 190, icon: 104, road: 30, dash: 34 },
};

export function TravelLoader({
  vehicles = ['bus'],
  label,
  size = 'md',
  cycleMs = 2400,
  width: fixedWidth,
}: {
  vehicles?: Vehicle[];
  label?: string;
  size?: keyof typeof SIZES;
  /** How long each vehicle runs before the next one takes over. */
  cycleMs?: number;
  width?: number;
}) {
  const theme = useTheme();
  const dims = SIZES[size];
  const [width, setWidth] = useState(fixedWidth ?? 280);
  const [index, setIndex] = useState(0);
  const [x] = useState(() => new Animated.Value(-(fixedWidth ?? 280)));
  const [bob] = useState(() => new Animated.Value(0));
  const [flow] = useState(() => new Animated.Value(0));
  const [scenery] = useState(() => new Animated.Value(0));

  const vehicle = vehicles[index % vehicles.length];
  const flying = vehicle === 'plane';
  const onRails = vehicle === 'train';

  // Running in place: bob, road markings and scenery stream past.
  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: -3, duration: 170, useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 170, useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.timing(flow, {
          toValue: 1,
          duration: 420,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.timing(scenery, {
          toValue: 1,
          duration: 2400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bob, flow, scenery]);

  // Drive in; with several vehicles, drive off after cycleMs and let the next one in.
  useEffect(() => {
    x.setValue(-width / 2 - dims.icon);
    const enter = Animated.timing(x, {
      toValue: 0,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    enter.start();
    if (vehicles.length < 2) return () => enter.stop();
    const timer = setTimeout(() => {
      Animated.timing(x, {
        toValue: width / 2 + dims.icon,
        duration: 450,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setIndex((i) => i + 1));
    }, cycleMs);
    return () => {
      enter.stop();
      clearTimeout(timer);
    };
  }, [index, width, vehicles.length, cycleMs, dims.icon, x]);

  const onLayout = (e: LayoutChangeEvent) => {
    if (!fixedWidth) setWidth(Math.round(e.nativeEvent.layout.width));
  };

  const gap = dims.dash;
  const dashes = Math.ceil(width / (dims.dash + gap)) + 2;
  const sceneryIcons: IconName[] = flying
    ? ['cloud', 'cloud', 'cloud', 'cloud']
    : ['pine-tree', 'office-building', 'pine-tree', 'home-city', 'pine-tree', 'office-building'];

  return (
    <View
      style={styles.wrap}
      onLayout={onLayout}
      accessibilityRole="progressbar"
      accessibilityLabel={label}>
      <View style={[styles.scene, { height: dims.height, width: fixedWidth }]}>
        <Animated.View
          style={[
            styles.scenery,
            {
              width: width * 2,
              bottom: flying ? dims.height * 0.35 : dims.road + 2,
              transform: [
                {
                  translateX: scenery.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }),
                },
              ],
            },
          ]}>
          {[...sceneryIcons, ...sceneryIcons].map((name, i) => (
            <Icon
              key={i}
              name={name}
              size={Math.round(dims.icon * (flying ? 0.45 : i % 2 ? 0.42 : 0.34))}
              color={flying ? theme.border : theme.muted}
            />
          ))}
        </Animated.View>

        <Animated.View
          style={[
            styles.vehicle,
            {
              bottom: flying ? dims.height * 0.3 : dims.road - (size === 'sm' ? 4 : 8),
              transform: [{ translateX: x }, { translateY: bob }],
            },
          ]}>
          <View style={[styles.speed, { gap: size === 'sm' ? 3 : 6 }]}>
            {[0.6, 1, 0.75].map((w, i) => (
              <View
                key={i}
                style={{
                  width: dims.icon * 0.3 * w,
                  height: size === 'sm' ? 2 : 3,
                  borderRadius: 2,
                  backgroundColor: theme.accent,
                  opacity: 0.55,
                }}
              />
            ))}
          </View>
          <View style={flying && styles.planeTurn}>
            <Icon name={ICONS[vehicle]} size={dims.icon} color={theme.accent} />
          </View>
        </Animated.View>

        {!flying && (
          <View
            style={[
              styles.road,
              { height: dims.road, backgroundColor: onRails ? 'transparent' : theme.text },
            ]}>
            {onRails && <View style={[styles.rail, { backgroundColor: theme.textSecondary }]} />}
            <Animated.View
              style={[
                styles.dashes,
                {
                  gap,
                  transform: [
                    {
                      translateX: flow.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -(dims.dash + gap)],
                      }),
                    },
                  ],
                },
              ]}>
              {Array.from({ length: dashes }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: onRails ? 4 : dims.dash,
                    height: onRails ? dims.road * 0.7 : 3,
                    borderRadius: 2,
                    backgroundColor: onRails ? theme.textSecondary : theme.background,
                  }}
                />
              ))}
            </Animated.View>
          </View>
        )}
      </View>
      {label && (
        <Text
          style={[styles.label, { color: theme.textSecondary, fontSize: size === 'sm' ? 13 : 15 }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'stretch', gap: 8 },
  scene: { justifyContent: 'flex-end', overflow: 'hidden', alignSelf: 'stretch' },
  scenery: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  vehicle: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  speed: { alignItems: 'flex-end', marginRight: 2 },
  // MaterialCommunityIcons' airplane points up; turn it to fly right.
  planeTurn: { transform: [{ rotate: '90deg' }] },
  road: { justifyContent: 'center', overflow: 'hidden', borderRadius: 3 },
  rail: { position: 'absolute', left: 0, right: 0, top: '20%', height: 2 },
  dashes: { flexDirection: 'row', alignItems: 'center' },
  label: { textAlign: 'center', fontWeight: '600' },
});

/**
 * Full-screen loading scene (like the boot screen) laid over the current screen while
 * something loads. Fades in, and out again when `visible` turns false.
 */
export function FullScreenLoader({
  visible,
  vehicles = ['bus'],
  title,
  subtitle,
  cycleMs = 1800,
}: {
  visible: boolean;
  vehicles?: Vehicle[];
  title: string;
  subtitle?: string;
  cycleMs?: number;
}) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));

  // Stays mounted and just fades, so showing it again is instant.
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 320,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[fullStyles.overlay, { backgroundColor: theme.background, opacity }]}>
      <TravelLoader size="lg" vehicles={vehicles} cycleMs={cycleMs} />
      <View style={fullStyles.text}>
        <Text style={[fullStyles.title, { color: theme.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[fullStyles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
    </Animated.View>
  );
}

const fullStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    gap: 28,
    zIndex: 50,
    elevation: 50,
  },
  text: { alignItems: 'center', gap: 6, paddingHorizontal: 32 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center' },
});
