/** Web placeholder: react-native-webview has no web support. The real map runs in the app. */
import { StyleSheet, Text, View } from 'react-native';

import type { LeafletMapProps } from './leaflet-map';

export type { LeafletMapProps, MapMarker, MapPolyline } from './leaflet-map';

export function LeafletMap({ style }: LeafletMapProps) {
  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.text}>Maps are available in the SafarSathi mobile app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDEFEC' },
  text: { color: '#2A5550', fontSize: 14, padding: 16, textAlign: 'center' },
});
