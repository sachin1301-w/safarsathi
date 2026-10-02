import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, useTheme } from '@/constants/theme';

export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

/** Placeholder for tabs that are built in a later phase. */
export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  const theme = useTheme();
  return (
    <Screen>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.note, { color: theme.textSecondary }]}>Coming in Phase {phase}.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, padding: Spacing.md, gap: Spacing.md },
  title: { fontSize: 28, fontWeight: '700', marginTop: Spacing.md },
  note: { fontSize: 16 },
});
