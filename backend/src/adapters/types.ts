// One interface per external data source. Mock implementations work offline;
// real ones (Open Charge Map, Sarvam, Cognee, later IRCTC/airlines) plug in behind the same shape.
import type { Charger, ChargerReport, ChargerStatus, Leg, Mode, ParkingLot, Place } from '../types';

export interface GeocodeAdapter {
  search(query: string, limit?: number): Place[];
  /** Best single match, or null. `strict` rejects matches on a shared word alone. */
  resolve(query: string, opts?: { strict?: boolean }): Place | null;
  byId(id: string): Place | undefined;
  all(): Place[];
}

export interface ChargerQuery {
  lat: number;
  lng: number;
  radiusKm: number;
  connector?: string;
  minKw?: number;
}

export interface ChargerAdapter {
  findNear(q: ChargerQuery): Promise<Charger[]>;
  getById(id: string): Promise<(Charger & { reports: ChargerReport[] }) | null>;
  report(id: string, userId: string, status: ChargerStatus, note?: string): Promise<Charger>;
}

export interface ParkingAdapter {
  findNear(lat: number, lng: number, radiusKm: number): Promise<ParkingLot[]>;
  getById(id: string): Promise<ParkingLot | null>;
  reserve(
    lotId: string,
    userId: string,
    arriveAt: Date,
    hours: number,
  ): Promise<{ reservationId: string; amount: number }>;
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface MetroLine {
  id: string;
  name: string;
  color: string;
  stations: Station[];
}

export interface MetroSystem {
  provider: string;
  speedKmh: number;
  headwayMins: number;
  fareSlabs: [maxKm: number, fare: number][];
  lines: MetroLine[];
}

export interface BusRoute {
  id: string;
  name: string;
  frequencyMins: number;
  stops: Station[];
}

export interface BusSystem {
  provider: string;
  speedKmh: number;
  minFare: number;
  farePerKm: number;
  maxFare: number;
  routes: BusRoute[];
}

export interface TransitSystem {
  city: string;
  metro?: MetroSystem;
  bus?: BusSystem;
}

export interface TransitAdapter {
  forCity(city: string): TransitSystem | undefined;
}

/** A scheduled intercity service (train, flight or intercity bus), normalised. */
export interface IntercityService {
  mode: Extract<Mode, 'TRAIN' | 'FLIGHT' | 'INTERCITY_BUS'>;
  serviceNo: string;
  name: string; // "Deccan Queen", "IndiGo 6E-512"
  provider: string;
  fromPlaceId: string;
  toPlaceId: string;
  departures: string[]; // daily, "HH:MM" IST
  durationMins: number;
  fare: number; // cheapest class
  fareClass?: string;
}

export interface ScheduleAdapter {
  services(): IntercityService[];
}

export interface BookingAdapter {
  /** Books a leg with its (mock) provider and returns a PNR / booking id. */
  book(leg: Leg): Promise<string>;
}

export interface SpeechAdapter {
  readonly available: boolean;
  transcribe(
    audio: Buffer,
    mimeType: string,
    languageCode?: string,
  ): Promise<{ text: string; languageCode: string }>;
  synthesize(
    text: string,
    languageCode: string,
  ): Promise<{ audioBase64: string; mimeType: string }>;
}

export type MemoryKind = 'PLACE' | 'PREFERENCE' | 'TRIP' | 'NOTE';

export interface MemoryAdapter {
  remember(userId: string, kind: MemoryKind, text: string): Promise<void>;
  recall(userId: string, query: string): Promise<string[]>;
}
