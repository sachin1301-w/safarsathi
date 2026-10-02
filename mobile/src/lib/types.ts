// Mirrors backend/src/types.ts (API response shapes).

export type Mode =
  | 'WALK'
  | 'METRO'
  | 'BUS'
  | 'AUTO'
  | 'BIKE_TAXI'
  | 'CAB'
  | 'TRAIN'
  | 'FLIGHT'
  | 'INTERCITY_BUS'
  | 'EV_DRIVE';

export interface Point {
  name: string;
  lat: number;
  lng: number;
}

export interface Leg {
  id: string;
  mode: Mode;
  from: Point;
  to: Point;
  departAt: string;
  arriveAt: string;
  durationMins: number;
  cost: number;
  provider?: string;
  serviceNo?: string;
  bookingRef?: string;
  chargerStopId?: string;
  status: 'ON_TIME' | 'DELAYED' | 'CANCELLED';
  delayMins?: number;
  distanceKm?: number;
  notes?: string;
}

export type OptionLabel = 'FASTEST' | 'CHEAPEST' | 'GREENEST';

export interface Itinerary {
  label: OptionLabel;
  /** Metrics this option genuinely wins; empty for an alternative. */
  badges: OptionLabel[];
  title: string;
  legs: Leg[];
  totalMins: number;
  totalCost: number;
  co2SavedKg: number;
  arriveBy?: string;
  onTime?: boolean;
  tripId?: string;
  /** Set on replan options: accepting one replaces the disrupted trip. */
  replacesTripId?: string;
}

export type ChargerStatus = 'WORKING' | 'BUSY' | 'BROKEN' | 'UNKNOWN';

export interface Charger {
  id: string;
  name: string;
  operator: string;
  lat: number;
  lng: number;
  powerKw: number;
  connectors: string[];
  status: ChargerStatus;
  pricePerKwh: number;
  lastVerified: string;
  distanceKm?: number;
}

export interface ChargerReport {
  id: string;
  status: ChargerStatus;
  note?: string | null;
  createdAt: string;
}

export interface ParkingLot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalSpots: number;
  ratePerHour: number;
  type: 'MALL' | 'STATION' | 'AIRPORT' | 'STREET' | 'MULTILEVEL';
  hourlyPattern: number[];
  hasEvCharging: boolean;
  predictedFreeSpots?: number;
  distanceKm?: number;
}

export type TripStatus = 'PLANNED' | 'BOOKED' | 'IN_PROGRESS' | 'DISRUPTED' | 'DONE' | 'REPLACED';

export interface Trip {
  id: string;
  title: string;
  status: TripStatus;
  option: OptionLabel;
  legs: Leg[];
  totalMins: number;
  totalCost: number;
  co2SavedKg: number;
  arriveBy?: string | null;
  alertMessage?: string | null;
  createdAt: string;
}

export type Card =
  | { type: 'itinerary'; data: Itinerary }
  | { type: 'chargers'; data: Charger[] }
  | { type: 'parking'; data: ParkingLot[] }
  | { type: 'booking'; data: { tripId: string; bookingRef: string } };

export interface Place {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  type: string;
}

export interface Language {
  code: string;
  name: string;
  native: string;
}

export interface Profile {
  id: string;
  name: string;
  language: string;
  hasEv: boolean;
  evRangeKm: number | null;
  evConnector: string | null;
  evBatteryPct: number | null;
  home: Place | null;
  office: Place | null;
  services?: { chargers: string; speech: string; memory: string };
  languages?: Language[];
}

export interface PlanResult {
  from: Place;
  to: Place;
  options: Itinerary[];
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  cards: Card[];
  mode: 'ai' | 'offline';
}
