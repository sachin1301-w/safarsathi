import { prisma } from '../lib/db';
import { haversineKm } from '../lib/geo';
import { elementPoint, overpassAmenity, type OsmElement } from '../lib/osm';
import type { ParkingLot, ParkingType } from '../types';
import { MockParkingAdapter } from './parking.mock';

const FETCH_RADIUS_KM = 5;
const DUPLICATE_KM = 0.1;
/** Parking with any of these access tags isn't open to the public. */
const PRIVATE_ACCESS = ['private', 'no', 'customers', 'residents', 'permit'];

/** Typical occupancy by hour (0..1) for lots with no history: busy days and evenings. */
const PATTERNS: Record<ParkingType, number[]> = {
  MALL: [
    0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.7, 0.7, 0.7, 0.75, 0.85,
    0.9, 0.9, 0.8, 0.6, 0.3, 0.15,
  ],
  STATION: [
    0.4, 0.4, 0.4, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.85, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.85, 0.9,
    0.9, 0.85, 0.75, 0.65, 0.55, 0.45,
  ],
  AIRPORT: [
    0.6, 0.6, 0.6, 0.6, 0.65, 0.7, 0.75, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.85,
    0.85, 0.85, 0.8, 0.75, 0.7, 0.65,
  ],
  STREET: [
    0.2, 0.15, 0.1, 0.1, 0.1, 0.2, 0.3, 0.45, 0.65, 0.75, 0.8, 0.8, 0.8, 0.75, 0.75, 0.78, 0.82,
    0.88, 0.9, 0.85, 0.7, 0.5, 0.35, 0.25,
  ],
  MULTILEVEL: [
    0.2, 0.15, 0.1, 0.1, 0.1, 0.15, 0.25, 0.4, 0.6, 0.7, 0.75, 0.8, 0.8, 0.8, 0.8, 0.8, 0.85, 0.9,
    0.9, 0.85, 0.7, 0.5, 0.35, 0.25,
  ],
};

/** Lots with no capacity tag: a rough size for the kind of parking. */
const DEFAULT_SPOTS: Record<ParkingType, number> = {
  MALL: 200,
  STATION: 100,
  AIRPORT: 300,
  STREET: 30,
  MULTILEVEL: 150,
};

/**
 * Public parking anywhere in India from OpenStreetMap, plus the Pune demo lots. OSM rarely has
 * capacity or prices, so spots are estimated and an unknown rate is stored as -1. Lots are saved
 * to SQLite (ids start with "osm-") so reservations work.
 */
export class OsmParkingAdapter extends MockParkingAdapter {
  async findNear(lat: number, lng: number, radiusKm: number): Promise<ParkingLot[]> {
    try {
      const elements = await overpassAmenity(
        'parking',
        lat,
        lng,
        Math.min(radiusKm, FETCH_RADIUS_KM),
        120,
      );
      const demo = await prisma.parkingLot.findMany({
        where: { NOT: { id: { startsWith: 'osm-' } } },
      });
      for (const e of elements) {
        const lot = osmParkingRow(e);
        if (!lot) continue;
        const { id, ...row } = lot;
        if (!row.lat || demo.some((d) => haversineKm(d, row) < DUPLICATE_KM)) continue;
        await prisma.parkingLot.upsert({ where: { id }, create: { id, ...row }, update: row });
      }
    } catch (err) {
      console.warn('OpenStreetMap parking unavailable, using saved lots:', (err as Error).message);
    }
    return super.findNear(lat, lng, radiusKm);
  }
}

function parkingType(tags: Record<string, string>): ParkingType {
  const name = `${tags.name ?? ''} ${tags.operator ?? ''}`.toLowerCase();
  if (/airport/.test(name)) return 'AIRPORT';
  if (/station|railway|metro|junction/.test(name)) return 'STATION';
  if (/mall|market|plaza/.test(name)) return 'MALL';
  if (tags.parking === 'multi-storey' || tags.parking === 'underground') return 'MULTILEVEL';
  return 'STREET';
}

/** A ParkingLot table row for an OSM parking area, or null if it isn't public. */
export function osmParkingRow(e: OsmElement) {
  const tags = e.tags ?? {};
  if (PRIVATE_ACCESS.includes(tags.access ?? '')) return null;
  const type = parkingType(tags);
  const capacity = Number(tags.capacity);
  const { lat, lng } = elementPoint(e);
  const street = tags['addr:street'];
  return {
    id: `osm-${e.type[0]}${e.id}`,
    name: tags.name ?? (street ? `Parking, ${street}` : 'Public parking'),
    lat,
    lng,
    totalSpots: Number.isFinite(capacity) && capacity > 0 ? capacity : DEFAULT_SPOTS[type],
    ratePerHour: tags.fee === 'no' ? 0 : -1, // -1 = unknown
    type,
    hourlyPattern: JSON.stringify(PATTERNS[type]),
    hasEvCharging: !!tags['capacity:charging'],
  };
}
