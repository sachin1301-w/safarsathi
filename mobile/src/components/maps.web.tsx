/**
 * Web stand-in for react-native-maps, which only supports Android and iOS. Keeps the web
 * build (and Expo Router's server render) from crashing; the real maps run in the app.
 */
import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

const MapView = forwardRef<unknown, { style?: StyleProp<ViewStyle>; children?: ReactNode }>(
  function MapView({ style }, ref) {
    // The screens call these on the native map; make them harmless here.
    useImperativeHandle(ref, () => ({ animateToRegion() {}, fitToCoordinates() {} }));
    return (
      <View style={[style, styles.placeholder]}>
        <Text style={styles.text}>Maps are available in the SafarSathi mobile app.</Text>
      </View>
    );
  },
);

export default MapView;
export const Marker = (_props: { children?: ReactNode }) => null;
export const Polyline = () => null;

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDEFEC' },
  text: { color: '#2A5550', fontSize: 14, padding: 16, textAlign: 'center' },
});
