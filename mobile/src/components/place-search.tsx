import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui';
import { Radius, Spacing, TouchTarget, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Place } from '@/lib/types';

/** Search box with place suggestions from the backend's geocoder. */
export function PlaceSearch({
  value,
  onSelect,
  placeholder = 'Search a destination',
}: {
  value: Place | null;
  onSelect: (place: Place) => void;
  placeholder?: string;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!query.trim()) return;
    const t = setTimeout(() => {
      api
        .searchPlaces(query)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const showResults = focused && query.trim().length > 0 && results.length > 0;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.box,
          { backgroundColor: theme.surface, borderColor: focused ? theme.accent : theme.border },
        ]}>
        <Icon name="magnify" color={theme.textSecondary} />
        <TextInput
          value={focused ? query : (value?.name ?? query)}
          onChangeText={setQuery}
          onFocus={() => {
            setFocused(true);
            setQuery('');
          }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          returnKeyType="search"
          accessibilityLabel={placeholder}
        />
      </View>
      {showResults && (
        <View
          style={[styles.results, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {results.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                onSelect(p);
                setQuery('');
                setFocused(false);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.result,
                pressed && { backgroundColor: theme.surfaceAlt },
              ]}>
              <Icon name="map-marker-outline" color={theme.accent} />
              <View>
                <Text style={[styles.resultName, { color: theme.text }]}>{p.name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{p.city}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 10 },
  box: {
    minHeight: TouchTarget + 4,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.sm },
  // Inline (not absolutely positioned) so maps and lists below can't cover the suggestions.
  results: {
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  result: {
    minHeight: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  resultName: { fontSize: 15, fontWeight: '600' },
});
