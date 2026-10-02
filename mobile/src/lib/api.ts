import Constants from 'expo-constants';

import type {
  Charger,
  ChatResponse,
  ChatTurn,
  ChargerReport,
  ChargerStatus,
  Itinerary,
  OptionLabel,
  ParkingLot,
  Place,
  PlanResult,
  Profile,
  Trip,
} from './types';

/**
 * A public https EXPO_PUBLIC_API_URL (a tunnel or cloud backend) always wins, so any phone
 * anywhere can use it. Otherwise the backend runs on the same laptop as the Expo dev server,
 * so in Expo Go use the address the app was loaded from; that follows the laptop when its IP
 * changes (Wi-Fi vs phone hotspot) without editing .env.
 */
function apiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured?.startsWith('https://')) return configured.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:4000`;
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const API_URL = apiUrl();

// The logged-in session. Set by AuthProvider; a 401 from the server signs the user out.
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}
export function setOnUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn;
}
export const authHeaders = (): Record<string, string> =>
  authToken ? { Authorization: `Bearer ${authToken}` } : {};

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init?.headers },
      signal: AbortSignal.timeout(init?.timeoutMs ?? 15_000),
    });
  } catch (e) {
    throw new Error(
      (e as Error).name === 'TimeoutError'
        ? `SafarSathi at ${API_URL} took too long to answer. Check the backend terminal is running, then try again.`
        : `Can't reach SafarSathi at ${API_URL}. Start the backend (npm run dev) on the laptop that runs Expo.`,
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized?.();
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export interface AuthResponse {
  token: string;
  user: { id: string; name: string };
}

const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

const post = <T>(path: string, body: unknown, timeoutMs?: number) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body), timeoutMs });

export const api = {
  baseUrl: API_URL,
  health: () => request<{ ok: boolean }>('/health', { timeoutMs: 4000 }),

  signup: (body: { name: string; email: string; password: string; language?: string }) =>
    post<AuthResponse>('/auth/signup', body),
  login: (body: { email: string; password: string }) => post<AuthResponse>('/auth/login', body),
  logout: () => post<{ ok: boolean }>('/auth/logout', {}),

  me: () => request<Profile>('/me'),
  updateMe: (patch: { language?: string; evBatteryPct?: number }) =>
    request<Profile>('/me', { method: 'PATCH', body: JSON.stringify(patch) }),
  searchPlaces: (q: string) => request<Place[]>(`/places?${qs({ q })}`),
  nearestPlace: (lat: number, lng: number) =>
    request<{ place: Place; distanceKm: number }>(`/places/nearest?${qs({ lat, lng })}`),

  chargers: (p: {
    lat: number;
    lng: number;
    radiusKm: number;
    connector?: string;
    minKw?: number;
  }) => request<Charger[]>(`/chargers?${qs(p)}`),
  charger: (id: string) => request<Charger & { reports: ChargerReport[] }>(`/chargers/${id}`),
  reportCharger: (id: string, status: Exclude<ChargerStatus, 'UNKNOWN'>, note?: string) =>
    post<Charger>(`/chargers/${id}/report`, { status, note }),

  parking: (p: { lat: number; lng: number; radiusKm: number; arriveAt?: string }) =>
    request<ParkingLot[]>(`/parking?${qs(p)}`),
  reserveParking: (id: string, arriveAt: string, hours: number) =>
    post<{ reservationId: string; amount: number }>(`/parking/${id}/reserve`, { arriveAt, hours }),

  planJourney: (body: {
    from: string | { name: string; lat: number; lng: number };
    to: string;
    arriveBy?: string;
    departAt?: string;
    preference?: OptionLabel;
    useEv?: boolean;
  }) => post<PlanResult>('/journeys/plan', body, 20_000),
  saveTrip: (itinerary: Itinerary) => post<Trip>('/trips', itinerary),
  trip: (id: string) => request<Trip>(`/trips/${id}`),
  trips: () => request<Trip[]>('/trips'),
  bookLeg: (tripId: string, legId: string) =>
    post<{ bookingRef: string }>('/bookings', { tripId, legId }),
  bookAll: (tripId: string) => post<Trip>(`/trips/${tripId}/book-all`, {}),
  disrupt: (tripId: string, legId: string, delayMins: number) =>
    post<{ ok: boolean; broken: boolean; message: string }>('/demo/disrupt', {
      tripId,
      legId,
      delayMins,
    }),
  activeAlerts: () =>
    request<{ tripId: string; title: string; message: string; broken: boolean }[]>(
      '/alerts/active',
    ),
  dismissAlert: (tripId: string) => post<{ ok: boolean }>(`/alerts/${tripId}/dismiss`, {}),

  chat: (messages: ChatTurn[], language: string, location?: { lat: number; lng: number }) =>
    post<ChatResponse>('/chat', { messages, language, location }, 45_000),
  transcribe: (audioBase64: string, mimeType: string, languageCode?: string) =>
    post<{ text: string; languageCode: string }>(
      '/speech/transcribe',
      { audioBase64, mimeType, languageCode },
      30_000,
    ),
  synthesize: (text: string, languageCode: string) =>
    post<{ audioBase64: string; mimeType: string }>(
      '/speech/synthesize',
      { text, languageCode },
      30_000,
    ),
};
