// Shared domain types. mobile/src/lib/types.ts mirrors the API-facing ones.

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

export type LegStatus = 'ON_TIME' | 'DELAYED' | 'CANCELLED';

export interface Leg {
  id: string;
  mode: Mode;
  from: Point;
  to: Point;
  departAt: string; // ISO time
  arriveAt: string;
  durationMins: number;
  cost: number; // INR
  provider?: string; // "Pune Metro", "IndiGo", "IRCTC (mock)"
  serviceNo?: string; // train no, flight no, bus route
  bookingRef?: string; // mock PNR / booking id
  chargerStopId?: string; // for EV_DRIVE legs that end at a charger
  status: LegStatus;
  delayMins?: number;
  distanceKm?: number;
  notes?: string; // e.g. "Charge 25 min to 80%"
}

export type OptionLabel = 'FASTEST' | 'CHEAPEST' | 'GREENEST';

export interface Itinerary {
  label: OptionLabel;
  /** Metrics this option is genuinely best at among all candidates; empty for an alternative. */
  badges: OptionLabel[];
  title: string; // "Kothrud → Connaught Place"
  legs: Leg[];
  totalMins: number;
  totalCost: number;
  co2SavedKg: number;
  arriveBy?: string;
  onTime?: boolean;
  tripId?: string; // set once the itinerary is saved as a Trip
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

export type ParkingType = 'MALL' | 'STATION' | 'AIRPORT' | 'STREET' | 'MULTILEVEL';

export interface ParkingLot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalSpots: number;
  ratePerHour: number;
  type: ParkingType;
  hourlyPattern: number[];
  hasEvCharging: boolean;
  predictedFreeSpots?: number;
  distanceKm?: number;
}

export interface Trip {
  id: string;
  title: string;
  status: 'PLANNED' | 'BOOKED' | 'IN_PROGRESS' | 'DISRUPTED' | 'DONE';
  option: OptionLabel;
  legs: Leg[];
  totalMins: number;
  totalCost: number;
  co2SavedKg: number;
  arriveBy?: string | null;
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
  type: 'AREA' | 'AIRPORT' | 'STATION' | 'BUS_STAND' | 'LANDMARK' | 'MALL' | 'OFFICE';
  aliases: string[];
}
