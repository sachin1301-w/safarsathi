import { prisma } from '../lib/db';
import { boxAround, haversineKm } from '../lib/geo';
import {
  elementPoint,
  ENOUGH_SAVED,
  MAX_WAIT_MS,
  overpassAmenity,
  settleWithin,
  type OsmElement,
} from '../lib/osm';
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
 * to the database (ids start with "osm-") so reservations work.
 */
export class OsmParkingAdapter extends MockParkingAdapter {
  async findNear(lat: number, lng: number, radiusKm: number): Promise<ParkingLot[]> {
    const saved = await super.findNear(lat, lng, radiusKm);
    const refresh = this.refresh(lat, lng, radiusKm);
    if (saved.length >= ENOUGH_SAVED) return saved;
    await settleWithin(refresh, MAX_WAIT_MS);
    return super.findNear(lat, lng, radiusKm);
  }

  /** Fetches the area from OpenStreetMap and saves lots not seen before. Never throws. */
  private async refresh(lat: number, lng: number, radiusKm: number) {
    try {
      const elements = await overpassAmenity(
        'parking',
        lat,
        lng,
        Math.min(radiusKm, FETCH_RADIUS_KM),
        120,
      );
      const demo = await prisma.parkingLot.findMany({
        where: {
          NOT: { id: { startsWith: 'osm-' } },
          ...boxAround({ lat, lng }, FETCH_RADIUS_KM + 1),
        },
      });
      const rows = elements
        .map(osmParkingRow)
        .filter((r): r is NonNullable<typeof r> => !!r?.lat)
        .filter((r) => !demo.some((d) => haversineKm(d, r) < DUPLICATE_KM));
      // Insert only new lots, in one batch.
      const saved = await prisma.parkingLot.findMany({
        where: { id: { in: rows.map((r) => r.id) } },
        select: { id: true },
      });
      const known = new Set(saved.map((r) => r.id));
      const fresh = rows.filter((r) => !known.has(r.id));
      if (fresh.length) await prisma.parkingLot.createMany({ data: fresh });
    } catch (err) {
      console.warn('OpenStreetMap parking unavailable, using saved lots:', (err as Error).message);
    }
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
