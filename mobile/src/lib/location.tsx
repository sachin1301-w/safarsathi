import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api } from './api';
import type { Place } from './types';

/** Rough bounding box of India: the app's data (places, chargers, parking) covers the country. */
const inIndia = (c: { lat: number; lng: number }) =>
  c.lat > 6 && c.lat < 37.5 && c.lng > 68 && c.lng < 97.5;

export interface LocationState {
  status: 'locating' | 'ready' | 'denied' | 'unavailable';
  coords: { lat: number; lng: number } | null;
  /** Nearest known place and how far it is. */
  nearest: { place: Place; distanceKm: number } | null;
  /** True when the user is in India, the area the app's data covers. */
  covered: boolean;
  refresh: () => void;
}

const LocationContext = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationState['status']>('locating');
  const [coords, setCoords] = useState<LocationState['coords']>(null);
  const [nearest, setNearest] = useState<LocationState['nearest']>(null);

  // State is only set in promise callbacks, so this is safe to start from an effect.
  const locate = useCallback(() => {
    const apply = (pos: Location.LocationObject | null) => {
      if (!pos) return;
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(c);
      setStatus('ready');
      api
        .nearestPlace(c.lat, c.lng)
        .then(setNearest)
        .catch(() => undefined);
    };
    Location.requestForegroundPermissionsAsync()
      .then(async ({ granted }) => {
        if (!granted) {
          setStatus('denied');
          return;
        }
        // A cached fix first so maps can centre quickly, then a fresh one.
        apply(await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }));
        apply(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      })
      .catch(() => setStatus((s) => (s === 'ready' ? s : 'unavailable')));
  }, []);

  useEffect(locate, [locate]);

  const refresh = useCallback(() => {
    setStatus('locating');
    locate();
  }, [locate]);

  const covered = !!coords && inIndia(coords);

  return (
    <LocationContext.Provider value={{ status, coords, nearest, covered, refresh }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationState {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>');
  return ctx;
}

/** The user's position as a trip start, when they're in India. */
export function useCurrentOrigin(): { name: string; lat: number; lng: number } | null {
  const { coords, covered } = useLocation();
  // Memoised so screens can use it as an effect dependency without refetching every render.
  return useMemo(
    () =>
      coords && covered ? { name: 'Current location', lat: coords.lat, lng: coords.lng } : null,
    [coords, covered],
  );
}
