/**
 * Log in or create an account. Trips, alerts and memories are saved per account.
 * Styled like the website: on the web the 3D night city drifts behind a HUD glass panel next to
 * the glowing SAFARSATHI title; phones get drifting glow lights, twinkling stars and the vehicle
 * animation instead (three.js is website-only).
 */
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CinematicScene } from '@/components/cinematic-scene';
import { GoogleButton } from '@/components/google-button';
import { TravelLoader } from '@/components/travel-loader';
import {
  Button,
  FadeIn,
  Icon,
  isHovered,
  type IconName,
  webData,
  webInteractive,
} from '@/components/ui';
import { Accent, Radius, Spacing, TouchTarget, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useAppColorScheme } from '@/lib/theme-preference';

type Mode = 'login' | 'signup';

const WEB = Platform.OS === 'web';
/** Browsers at least this wide put the title and the form side by side. */
const SPLIT = 980;

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'map-marker-path',
    title: 'Any trip in India',
    text: 'Metro, bus, train, flight and cab, door to door',
  },
  {
    icon: 'ev-station',
    title: 'EV & parking',
    text: 'Live chargers and free spots where you arrive',
  },
  { icon: 'island', title: 'Holidays', text: 'Places to see, hotels and the full budget' },
  { icon: 'translate', title: '11 languages', text: 'Type or speak, in your language' },
];

export function AuthScreen() {
  const theme = useTheme();
  const dark = useAppColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const split = WEB && width >= SPLIT;
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Android (edge-to-edge) doesn't resize the window for the keyboard, so pad the form by the
  // keyboard's height ourselves and bring the fields into view.
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboard(e.endCoordinates.height);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboard(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const submit = () =>
    run(() =>
      mode === 'login'
        ? login(email.trim(), password)
        : signup(name.trim(), email.trim(), password),
    );

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const gold = dark ? '#E9B949' : '#A87410';
  const titleSize = split ? 76 : Math.min(54, Math.max(30, (width - 48) / 9));

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            split && styles.contentSplit,
            keyboard > 0 && { justifyContent: 'flex-start', paddingBottom: keyboard + Spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled">
          {/* ---------- Brand ---------- */}
          <FadeIn style={[styles.brand, split && styles.brandSplit]}>
            {/* The vehicles make way for the form while the keyboard is open. */}
            {!WEB && keyboard === 0 && (
              <TravelLoader
                size="lg"
                vehicles={['bus', 'rickshaw', 'train', 'plane', 'ev']}
                cycleMs={2000}
              />
            )}
            <Text
              style={[styles.kicker, { color: gold }, split && { textAlign: 'left' }]}
              {...webData('display')}>
              INDIA&apos;S AI MOBILITY COPILOT
            </Text>
            <Text
              style={[
                styles.title,
                { fontSize: titleSize, color: theme.accent },
                !WEB && styles.titleNative,
                split && { textAlign: 'left' },
              ]}
              {...webData('display', 'gradientText', 'titleGlow')}>
              SAFARSATHI
            </Text>
            <Text
              style={[
                styles.modes,
                { color: dark ? theme.textSecondary : theme.text },
                split && { textAlign: 'left' },
              ]}
              {...webData('display')}>
              METRO · BUS · TRAIN · FLIGHT · CAB · EV
            </Text>
            {split && (
              <View style={styles.features}>
                {FEATURES.map((f, i) => (
                  <FadeIn key={f.title} delay={200 + i * 120} style={styles.featureWrap}>
                    <View
                      style={[
                        styles.feature,
                        {
                          borderColor: theme.border,
                          backgroundColor: dark ? 'rgba(10,13,20,.62)' : 'rgba(255,255,255,.82)',
                        },
                      ]}
                      {...webData('glass', 'tilt')}>
                      <View style={[styles.featureIcon, { backgroundColor: theme.accentSoft }]}>
                        <Icon name={f.icon} size={22} color={theme.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.featureTitle, { color: theme.text }]}>{f.title}</Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{f.text}</Text>
                      </View>
                    </View>
                  </FadeIn>
                ))}
              </View>
            )}
          </FadeIn>

          {/* ---------- Form panel ---------- */}
          <FadeIn delay={120} style={[styles.panelWrap, split && { width: 460 }]}>
            <View
              style={[
                styles.panel,
                { backgroundColor: theme.surface, borderColor: dark ? '#00BFA655' : theme.border },
                !WEB && styles.panelNative,
              ]}
              {...webData('hud', 'glass')}>
              <View style={styles.panelHead}>
                <View style={[styles.panelDot, { backgroundColor: Accent }]} />
                <Text style={[styles.panelKicker, { color: theme.accent }]} {...webData('display')}>
                  {mode === 'login' ? 'WELCOME BACK' : 'JOIN THE JOURNEY'}
                </Text>
              </View>
              <Text style={[styles.panelTitle, { color: theme.text }]}>
                {mode === 'login' ? 'Log in to your trips' : 'Create your account'}
              </Text>

              <View style={[styles.tabs, { backgroundColor: theme.surfaceAlt }]}>
                {(['login', 'signup'] as const).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => switchMode(m)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === m }}
                    style={(state) => [
                      styles.tab,
                      mode === m
                        ? { backgroundColor: theme.accent }
                        : isHovered(state) && { backgroundColor: theme.accentSoft },
                      webInteractive,
                    ]}>
                    <Text
                      style={[
                        styles.tabText,
                        { color: mode === m ? theme.onAccent : theme.textSecondary },
                      ]}>
                      {m === 'login' ? 'Log in' : 'Create account'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <FadeIn key={mode} style={styles.form}>
                {mode === 'signup' && (
                  <Field
                    icon="account-outline"
                    placeholder="Your name"
                    value={name}
                    onChangeText={setName}
                    autoComplete="name"
                  />
                )}
                <Field
                  icon="email-outline"
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoComplete="email"
                />
                <Field
                  icon="lock-outline"
                  placeholder={mode === 'signup' ? 'Password (6+ characters)' : 'Password'}
                  value={password}
                  onChangeText={setPassword}
                  secure={!showPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  onSubmit={submit}
                  right={
                    <Pressable
                      onPress={() => setShowPassword((s) => !s)}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                      <Icon
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                  }
                />

                {error && (
                  <View style={[styles.error, { backgroundColor: theme.dangerSoft }]}>
                    <Icon name="alert-circle-outline" size={18} color={theme.danger} />
                    <Text style={{ color: theme.danger, flex: 1 }}>{error}</Text>
                  </View>
                )}

                <View style={styles.cta} {...webData('glowButton')}>
                  <Button
                    label={busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
                    icon={mode === 'login' ? 'login' : 'account-plus'}
                    onPress={submit}
                    disabled={busy}
                  />
                </View>

                <GoogleButton onError={setError} />

                <Pressable
                  onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  accessibilityRole="button"
                  style={styles.switch}>
                  <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
                    {mode === 'login' ? 'New to SafarSathi? ' : 'Already have an account? '}
                    <Text style={{ color: theme.accent, fontWeight: '700' }}>
                      {mode === 'login' ? 'Create an account' : 'Log in'}
                    </Text>
                  </Text>
                </Pressable>
              </FadeIn>
            </View>
          </FadeIn>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Moving background: the website's 3D city, or glow lights and stars on phones. */
function Backdrop() {
  const theme = useTheme();
  // Read by the 3D scene every frame (no re-render).
  const [progress] = useState(() => ({ current: 0.08 }));

  // The camera slowly glides forward and back through the city while the page is open.
  useEffect(() => {
    if (!WEB) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      progress.current = 0.06 + 0.12 * (1 - Math.cos((now - start) / 9000)) * 0.5;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  if (WEB)
    return (
      <>
        <CinematicScene progress={progress} />
        {/* Keeps the form readable over bright parts of the scene. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              position: 'fixed',
              backgroundImage: `radial-gradient(ellipse at 72% 50%, ${theme.background}CC 0%, transparent 45%), radial-gradient(ellipse at 28% 52%, ${theme.background}99 0%, transparent 50%)`,
            } as unknown as ViewStyle,
          ]}
        />
      </>
    );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Orb color="#00BFA6" size={320} from={{ x: -120, y: -60 }} to={{ x: 40, y: 60 }} ms={9000} />
      <Orb
        color="#6366F1"
        size={280}
        from={{ x: 220, y: 260 }}
        to={{ x: 120, y: 160 }}
        ms={11000}
      />
      <Orb color="#EC4899" size={220} from={{ x: -40, y: 560 }} to={{ x: 80, y: 480 }} ms={13000} />
      <Stars />
    </View>
  );
}

function Orb({
  color,
  size,
  from,
  to,
  ms,
}: {
  color: string;
  size: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  ms: number;
}) {
  const dark = useAppColorScheme() === 'dark';
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: ms,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: ms,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, ms]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: dark ? 0.22 : 0.14,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
        ],
      }}
    />
  );
}

/** Fixed pseudo-random positions so the sky doesn't jump between renders. */
const STARS = Array.from({ length: 36 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  top: `${(i * 53 + 7) % 100}%`,
  size: 1.5 + (i % 3),
  group: i % 3,
})) as { left: `${number}%`; top: `${number}%`; size: number; group: number }[];

function Stars() {
  const theme = useTheme();
  const [twinkle] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.2)));
  useEffect(() => {
    const loops = twinkle.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 700),
          Animated.timing(v, { toValue: 0.9, duration: 1400, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.2, duration: 1400, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [twinkle]);
  return (
    <>
      {STARS.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: s.group === 1 ? theme.accent : theme.text,
            opacity: twinkle[s.group],
          }}
        />
      ))}
    </>
  );
}

function Field({
  icon,
  secure,
  right,
  onSubmit,
  ...input
}: {
  icon: IconName;
  placeholder: string;
  value: string;
  onChangeText: (s: string) => void;
  secure?: boolean;
  right?: React.ReactNode;
  onSubmit?: () => void;
  keyboardType?: 'email-address';
  autoComplete?: 'name' | 'email' | 'new-password' | 'current-password';
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.field,
        webInteractive,
        { cursor: 'auto' } as ViewStyle,
        {
          backgroundColor: theme.surfaceAlt,
          borderColor: focused ? theme.accent : theme.border,
        },
        focused && styles.fieldFocused,
      ]}>
      <Icon name={icon} color={focused ? theme.accent : theme.textSecondary} />
      <TextInput
        {...input}
        secureTextEntry={secure}
        autoCapitalize={input.autoComplete === 'name' ? 'words' : 'none'}
        autoCorrect={false}
        placeholderTextColor={theme.textSecondary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmit}
        returnKeyType={onSubmit ? 'go' : 'next'}
        style={[styles.input, { color: theme.text }, WEB && ({ outlineStyle: 'none' } as object)]}
        accessibilityLabel={input.placeholder}
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  contentSplit: {
    flexDirection: 'row',
    gap: 64,
    paddingHorizontal: 56,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  brand: { alignItems: 'center', gap: Spacing.sm, width: '100%', maxWidth: 460 },
  brandSplit: { flex: 1, alignItems: 'flex-start', maxWidth: 640, gap: 14 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 5, textAlign: 'center' },
  title: { fontWeight: '900', letterSpacing: 6, textAlign: 'center' },
  titleNative: {
    textShadowColor: 'rgba(0,191,166,.55)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  modes: { fontSize: 11, letterSpacing: 4, textAlign: 'center' },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 18 },
  featureWrap: { flexBasis: 280, flexGrow: 1 },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: { fontSize: 15, fontWeight: '800' },
  panelWrap: { width: '100%', maxWidth: 460 },
  panel: { padding: 26, gap: Spacing.md, borderWidth: 1, borderRadius: Radius.lg },
  panelNative: {
    shadowColor: '#00BFA6',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelDot: { width: 8, height: 8, borderRadius: 4 },
  panelKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  panelTitle: { fontSize: 24, fontWeight: '800', marginTop: -6 },
  switch: { alignItems: 'center', paddingVertical: Spacing.xs },
  tabs: { flexDirection: 'row', borderRadius: Radius.pill, padding: 4 },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontSize: 15, fontWeight: '700' },
  form: { gap: Spacing.md },
  field: {
    minHeight: TouchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  fieldFocused: {
    shadowColor: '#00BFA6',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.sm },
  cta: { borderRadius: Radius.md },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
});
