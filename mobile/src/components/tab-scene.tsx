/**
 * Wraps a tab screen. Visited tabs stay mounted (so Chat keeps its conversation), and on the
 * website screens are see-through to show the animated background, so a tab that isn't active
 * must be hidden explicitly or the pages show through each other. Phones need nothing.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export function TabScene({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  if (Platform.OS !== 'web') return children;
  return <View style={[styles.fill, !focused && styles.hidden]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
