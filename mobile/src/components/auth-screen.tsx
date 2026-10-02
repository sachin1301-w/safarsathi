/** Log in or create an account. Trips, alerts and memories are saved per account. */
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, FadeIn, Icon, type IconName } from '@/components/ui';
import { Radius, Spacing, TouchTarget, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

/** Seeded by `npm run db:seed` in backend/. */
const DEMO = { email: 'demo@safarsathi.app', password: 'demo1234' };

type Mode = 'login' | 'signup';

export function AuthScreen() {
  const theme = useTheme();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FadeIn style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: theme.accent }]}>
              <Icon name="bus-side" size={34} color={theme.onAccent} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>SafarSathi</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 15, textAlign: 'center' }}>
              {mode === 'login'
                ? 'Welcome back. Log in to see your trips.'
                : 'Create an account to save your trips.'}
            </Text>
          </FadeIn>

          <View style={[styles.tabs, { backgroundColor: theme.surfaceAlt }]}>
            {(['login', 'signup'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                style={[styles.tab, mode === m && { backgroundColor: theme.surface }]}>
                <Text
                  style={[
                    styles.tabText,
                    { color: mode === m ? theme.text : theme.textSecondary },
                  ]}>
                  {m === 'login' ? 'Log in' : 'Sign up'}
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

            <Button
              label={busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
              icon={mode === 'login' ? 'login' : 'account-plus'}
              onPress={submit}
              disabled={busy}
            />

            {mode === 'login' && (
              <Button
                label="Use demo account"
                icon="account-star-outline"
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  setEmail(DEMO.email);
                  setPassword(DEMO.password);
                  run(() => login(DEMO.email, DEMO.password));
                }}
              />
            )}
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
        { backgroundColor: theme.surface, borderColor: focused ? theme.accent : theme.border },
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
        style={[styles.input, { color: theme.text }]}
        accessibilityLabel={input.placeholder}
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg, gap: Spacing.lg },
  brand: { alignItems: 'center', gap: Spacing.sm },
  logo: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderRadius: Radius.pill, padding: 4 },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontSize: 15, fontWeight: '700' },
  form: { gap: Spacing.md },
  field: {
    minHeight: TouchTarget + 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.sm },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
});
