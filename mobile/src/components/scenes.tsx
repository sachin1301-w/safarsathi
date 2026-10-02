/**
 * One loading scene per screen, so each wait looks like what it's doing: a route being drawn,
 * the copilot thinking, an EV charging, a car parking, tickets being issued, a pin dropping.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { StatusColors, useTheme } from '@/constants/theme';

const native = { useNativeDriver: true } as const;
const loop = (a: Animated.CompositeAnimation) => Animated.loop(a);

/** Starts the given looping animations on mount and stops them on unmount. */
function useLoops(make: () => Animated.CompositeAnimation[]) {
  const [anims] = useState(make);
  useEffect(() => {
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [anims]);
}

// ------------------------------------------------------------- route planning

const ROUTE_VEHICLES: IconName[] = ['rickshaw', 'bus-side', 'train-car-passenger', 'airplane'];

/** Start and end pins; the route draws itself while a vehicle travels it, then the next mode. */
export function RouteScene() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const track = Math.min(width - 96, 320);
  const [progress] = useState(() => new Animated.Value(0));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let stopped = false;
    const run = () => {
      progress.setValue(0);
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(250),
      ]).start(({ finished }) => {
        if (!finished || stopped) return;
        setIndex((i) => i + 1);
        run();
      });
    };
    run();
    return () => {
      stopped = true;
      progress.stopAnimation();
    };
  }, [progress]);

  const icon = ROUTE_VEHICLES[index % ROUTE_VEHICLES.length];
  const flying = icon === 'airplane';
  const dots = Math.floor(track / 14);

  return (
    <View style={[styles.center, { height: 190 }]}>
      <View style={{ width: track + 56, height: 120, justifyContent: 'flex-end' }}>
        {/* dotted track and the drawn route on top of it */}
        <View style={[styles.routeTrack, { left: 28, width: track }]}>
          {Array.from({ length: dots }, (_, i) => (
            <View key={i} style={[styles.routeDot, { backgroundColor: theme.border }]} />
          ))}
        </View>
        <Animated.View
          style={[
            styles.routeDrawn,
            {
              left: 28,
              width: track,
              backgroundColor: theme.accent,
              transformOrigin: 'left',
              transform: [{ scaleX: progress }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.routeVehicle,
            {
              left: 28 - 20,
              transform: [
                {
                  translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, track] }),
                },
                {
                  translateY: flying
                    ? progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -46, 0] })
                    : 0,
                },
              ],
            },
          ]}>
          <View
            style={[
              styles.routeBadge,
              { backgroundColor: theme.surface, borderColor: theme.accent },
            ]}>
            <View style={flying && { transform: [{ rotate: '90deg' }] }}>
              <Icon name={icon} size={24} color={theme.accent} />
            </View>
          </View>
        </Animated.View>
        <View style={[styles.pin, { left: 0 }]}>
          <Icon name="map-marker-radius" size={40} color="#16A34A" />
        </View>
        <View style={[styles.pin, { right: 0 }]}>
          <Icon name="flag-checkered" size={36} color={theme.text} />
        </View>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ chat / AI

const ORBIT: IconName[] = ['bus-side', 'train', 'airplane', 'ev-station'];

/** The copilot "thinking": a pulsing core with travel modes orbiting it. */
export function OrbitScene() {
  const theme = useTheme();
  const R = 78;
  const [spin] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [ripple] = useState(() => new Animated.Value(0));
  useLoops(() => [
    loop(Animated.timing(spin, { toValue: 1, duration: 4200, easing: Easing.linear, ...native })),
    loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, ...native }),
        Animated.timing(pulse, { toValue: 0, duration: 600, ...native }),
      ]),
    ),
    loop(
      Animated.timing(ripple, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        ...native,
      }),
    ),
  ]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counter = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <View style={[styles.center, { height: 220 }]}>
      <Animated.View
        style={[
          styles.ripple,
          {
            borderColor: theme.accent,
            opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [
              { scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.2] }) },
            ],
          },
        ]}
      />
      <View
        style={[styles.orbitRing, { width: R * 2, height: R * 2, borderColor: theme.border }]}
      />
      <Animated.View
        style={{ position: 'absolute', width: R * 2, height: R * 2, transform: [{ rotate }] }}>
        {ORBIT.map((name, i) => {
          const a = (i / ORBIT.length) * 2 * Math.PI;
          return (
            <Animated.View
              key={name}
              style={[
                styles.orbitItem,
                {
                  left: R + Math.cos(a) * R - 18,
                  top: R + Math.sin(a) * R - 18,
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  transform: [{ rotate: counter }],
                },
              ]}>
              <Icon name={name} size={20} color={theme.accent} />
            </Animated.View>
          );
        })}
      </Animated.View>
      <Animated.View
        style={[
          styles.core,
          {
            backgroundColor: theme.accent,
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
            ],
          },
        ]}>
        <Icon name="robot-happy-outline" size={40} color={theme.onAccent} />
      </Animated.View>
    </View>
  );
}

// ------------------------------------------------------------------------ EV

/** An EV plugged into a charger: battery filling, bolt pulsing, power flowing along the cable. */
export function ChargingScene() {
  const theme = useTheme();
  const green = StatusColors.WORKING;
  const [fill] = useState(() => new Animated.Value(0));
  const [bolt] = useState(() => new Animated.Value(0));
  const [flow] = useState(() => new Animated.Value(0));
  useLoops(() => [
    loop(
      Animated.sequence([
        Animated.timing(fill, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          ...native,
        }),
        Animated.delay(300),
        Animated.timing(fill, { toValue: 0, duration: 0, ...native }),
      ]),
    ),
    loop(
      Animated.sequence([
        Animated.timing(bolt, { toValue: 1, duration: 350, ...native }),
        Animated.timing(bolt, { toValue: 0, duration: 350, ...native }),
      ]),
    ),
    loop(Animated.timing(flow, { toValue: 1, duration: 700, easing: Easing.linear, ...native })),
  ]);

  return (
    <View style={[styles.center, { height: 210, gap: 18 }]}>
      <View style={styles.chargeRow}>
        <Icon name="car-electric" size={72} color={theme.accent} />
        <View style={[styles.cable, { backgroundColor: theme.border }]}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.spark,
                {
                  backgroundColor: green,
                  transform: [
                    {
                      translateX: flow.interpolate({
                        inputRange: [0, 1],
                        outputRange: [70 - i * 24, -i * 24 - 6],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
        <Icon name="ev-station" size={64} color={theme.text} />
      </View>
      <View style={[styles.battery, { borderColor: theme.text }]}>
        <Animated.View
          style={[
            styles.batteryFill,
            { backgroundColor: green, transformOrigin: 'left', transform: [{ scaleX: fill }] },
          ]}
        />
        <Animated.View
          style={{
            opacity: bolt.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
            transform: [
              { scale: bolt.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) },
            ],
          }}>
          <Icon name="lightning-bolt" size={30} color={theme.text} />
        </Animated.View>
        <View style={[styles.batteryCap, { backgroundColor: theme.text }]} />
      </View>
    </View>
  );
}

// ------------------------------------------------------------------- parking

/** A car reverses into a marked bay under a big P sign, then the next one. */
export function ParkingScene() {
  const theme = useTheme();
  const [car] = useState(() => new Animated.Value(0));
  useLoops(() => [
    loop(
      Animated.sequence([
        Animated.timing(car, {
          toValue: 1,
          duration: 1300,
          easing: Easing.out(Easing.back(1.2)),
          ...native,
        }),
        Animated.delay(700),
        Animated.timing(car, {
          toValue: 2,
          duration: 400,
          easing: Easing.in(Easing.quad),
          ...native,
        }),
        Animated.timing(car, { toValue: 0, duration: 0, ...native }),
      ]),
    ),
  ]);
  const blue = '#2563EB';

  return (
    <View style={[styles.center, { height: 220 }]}>
      <View style={[styles.sign, { backgroundColor: blue }]}>
        <Text style={styles.signText}>P</Text>
      </View>
      <View style={[styles.signPole, { backgroundColor: theme.textSecondary }]} />
      <View style={styles.lot}>
        <View style={[styles.bay, { borderColor: theme.textSecondary }]} />
        <Animated.View
          style={{
            position: 'absolute',
            opacity: car.interpolate({ inputRange: [0, 0.2, 1.6, 2], outputRange: [0, 1, 1, 0] }),
            transform: [
              {
                translateX: car.interpolate({ inputRange: [0, 1, 2], outputRange: [170, 0, 0] }),
              },
            ],
          }}>
          <Icon name="car-side" size={70} color={theme.accent} />
        </Animated.View>
      </View>
    </View>
  );
}

// --------------------------------------------------------------------- trips

/** Tickets slide up and fan out, then get a BOOKED stamp. */
export function TicketScene() {
  const theme = useTheme();
  const [t] = useState(() => new Animated.Value(0));
  useLoops(() => [
    loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 3,
          duration: 1500,
          easing: Easing.out(Easing.cubic),
          ...native,
        }),
        Animated.timing(t, {
          toValue: 4,
          duration: 350,
          easing: Easing.out(Easing.back(2)),
          ...native,
        }),
        Animated.delay(700),
        Animated.timing(t, { toValue: 5, duration: 300, ...native }),
        Animated.timing(t, { toValue: 0, duration: 0, ...native }),
      ]),
    ),
  ]);
  const tickets: { icon: IconName; angle: number }[] = [
    { icon: 'train', angle: -12 },
    { icon: 'airplane', angle: 0 },
    { icon: 'bus-side', angle: 12 },
  ];

  return (
    <View style={[styles.center, { height: 220 }]}>
      {tickets.map((k, i) => (
        <Animated.View
          key={k.icon}
          style={[
            styles.ticket,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: t.interpolate({
                inputRange: [i, i + 0.3, 4.5, 5],
                outputRange: [0, 1, 1, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateY: t.interpolate({
                    inputRange: [i, i + 1],
                    outputRange: [90, 0],
                    extrapolate: 'clamp',
                  }),
                },
                { translateX: (i - 1) * 34 },
                {
                  rotate: t.interpolate({
                    inputRange: [i, i + 1],
                    outputRange: ['0deg', `${k.angle}deg`],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}>
          <View style={[styles.ticketStub, { backgroundColor: theme.accentSoft }]}>
            <Icon name={k.icon} size={26} color={theme.accent} />
          </View>
          <View style={{ gap: 6, flex: 1 }}>
            <View style={[styles.ticketLine, { backgroundColor: theme.border, width: '80%' }]} />
            <View style={[styles.ticketLine, { backgroundColor: theme.border, width: '55%' }]} />
          </View>
        </Animated.View>
      ))}
      <Animated.View
        style={[
          styles.stamp,
          {
            borderColor: StatusColors.WORKING,
            opacity: t.interpolate({
              inputRange: [3, 3.3, 4.5, 5],
              outputRange: [0, 1, 1, 0],
              extrapolate: 'clamp',
            }),
            transform: [
              { rotate: '-14deg' },
              {
                scale: t.interpolate({
                  inputRange: [3, 4],
                  outputRange: [2.2, 1],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}>
        <Text style={[styles.stampText, { color: StatusColors.WORKING }]}>BOOKED</Text>
      </Animated.View>
    </View>
  );
}

// ----------------------------------------------------------------- map cover

/** A pin drops onto the map with ripples spreading from where it lands. */
export function PinDropScene({ label }: { label?: string }) {
  const theme = useTheme();
  const [drop] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => new Animated.Value(0));
  useLoops(() => [
    loop(
      Animated.sequence([
        Animated.timing(drop, { toValue: 1, duration: 650, easing: Easing.bounce, ...native }),
        Animated.delay(900),
        Animated.timing(drop, { toValue: 0, duration: 0, ...native }),
      ]),
    ),
    loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 1550,
        easing: Easing.out(Easing.quad),
        ...native,
      }),
    ),
  ]);

  return (
    <View style={[styles.center, { gap: 12 }]}>
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.pinRing,
            {
              borderColor: theme.accent,
              opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [
                { scaleX: ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2] }) },
                { scaleY: ring.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.7] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={{
            transform: [
              { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-70, -26] }) },
            ],
          }}>
          <Icon name="map-marker" size={52} color={theme.accent} />
        </Animated.View>
      </View>
      {label && <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  // route
  routeTrack: {
    position: 'absolute',
    bottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  routeDot: { width: 6, height: 6, borderRadius: 3 },
  routeDrawn: { position: 'absolute', bottom: 19, height: 4, borderRadius: 2 },
  routeVehicle: { position: 'absolute', bottom: 2 },
  routeBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  pin: { position: 'absolute', bottom: 12 },
  // orbit
  ripple: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2 },
  orbitRing: { position: 'absolute', borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed' },
  orbitItem: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  // EV
  chargeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cable: { width: 70, height: 4, borderRadius: 2, overflow: 'hidden', justifyContent: 'center' },
  spark: { position: 'absolute', width: 10, height: 4, borderRadius: 2 },
  battery: {
    width: 150,
    height: 62,
    borderWidth: 4,
    borderRadius: 12,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batteryFill: { position: 'absolute', left: 4, top: 4, bottom: 4, right: 4, borderRadius: 6 },
  batteryCap: { position: 'absolute', right: -12, width: 8, height: 22, borderRadius: 3 },
  // parking
  sign: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  signText: { color: '#FFFFFF', fontSize: 36, fontWeight: '900' },
  signPole: { width: 4, height: 18 },
  lot: { width: 220, height: 96, alignItems: 'center', justifyContent: 'flex-end' },
  bay: {
    width: 110,
    height: 80,
    borderWidth: 4,
    borderTopWidth: 0,
    borderStyle: 'dashed',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  // trips
  ticket: {
    position: 'absolute',
    width: 170,
    height: 76,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  ticketStub: { width: 54, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  ticketLine: { height: 8, borderRadius: 4 },
  stamp: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    elevation: 6,
  },
  stampText: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  // pin
  pinRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    top: 4,
  },
});
