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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(init?.timeoutMs ?? 15_000),
    });
  } catch {
    throw new Error(
      `Can't reach SafarSathi at ${API_URL}. Is the backend running on the same Wi-Fi?`,
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
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
  health: () => request<{ ok: boolean }>('/health'),

  me: () => request<Profile>('/me'),
  updateMe: (patch: { language?: string; evBatteryPct?: number }) =>
    request<Profile>('/me', { method: 'PATCH', body: JSON.stringify(patch) }),
  searchPlaces: (q: string) => request<Place[]>(`/places?${qs({ q })}`),

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
    from: string;
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

  chat: (messages: ChatTurn[], language: string) =>
    post<ChatResponse>('/chat', { messages, language }, 45_000),
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
