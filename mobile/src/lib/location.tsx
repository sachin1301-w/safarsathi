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

/** Within this distance of a known place, the demo data covers where the user is. */
const COVERAGE_KM = 40;

export interface LocationState {
  status: 'locating' | 'ready' | 'denied' | 'unavailable';
  coords: { lat: number; lng: number } | null;
  /** Nearest known place and how far it is. */
  nearest: { place: Place; distanceKm: number } | null;
  /** True when the user is inside the area the demo data covers (Pune, Delhi, Mumbai, Bengaluru…). */
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

  const covered = !!nearest && nearest.distanceKm <= COVERAGE_KM;

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

/** The user's position as a trip start, when they're inside the demo data's coverage. */
export function useCurrentOrigin(): { name: string; lat: number; lng: number } | null {
  const { coords, covered } = useLocation();
  // Memoised so screens can use it as an effect dependency without refetching every render.
  return useMemo(
    () =>
      coords && covered ? { name: 'Current location', lat: coords.lat, lng: coords.lng } : null,
    [coords, covered],
  );
}
