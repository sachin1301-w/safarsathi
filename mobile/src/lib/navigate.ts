import { Linking } from 'react-native';

/** Opens turn-by-turn directions (Google Maps app, or the browser on web) to a point. */
export function openDirections(lat: number, lng: number) {
  return Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
  );
}
