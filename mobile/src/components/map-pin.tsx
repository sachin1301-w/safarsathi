import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from '@/components/maps';

import type { IconName } from './ui';

/**
 * A round coloured map pin with an icon and optional label.
 * Custom marker views are snapshotted on Android, so we track view changes only
 * briefly after mount; pass a `key` that includes the colour to re-render on change.
 */
export function MapPin({
  lat,
  lng,
  color,
  icon,
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  lat: number;
  lng: number;
  color: string;
  icon: IconName;
  label?: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracking(false), 600);
    return () => clearTimeout(t);
  }, [selected, label]);

  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={onPress}
      tracksViewChanges={tracking}
      accessibilityLabel={accessibilityLabel}
      anchor={{ x: 0.5, y: 0.5 }}>
      <View style={styles.wrap}>
        <View style={[styles.pin, { backgroundColor: color }, selected && styles.selected]}>
          <MaterialCommunityIcons name={icon} size={selected ? 18 : 14} color="#FFFFFF" />
        </View>
        {label ? (
          <View style={[styles.label, { borderColor: color }]}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  selected: { width: 38, height: 38, borderRadius: 19, borderWidth: 3 },
  label: {
    marginTop: 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  labelText: { fontSize: 11, fontWeight: '800', color: '#111827' },
});
