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
import type { Charger } from '../types';
import { MockChargerAdapter } from './chargers.mock';
import type { ChargerQuery } from './types';

/** Overpass gets slow and unreliable beyond this; the rest of a wide search comes from the DB. */
const FETCH_RADIUS_KM = 25;
/** An OSM charger this close to a demo charger is the same one. */
const DUPLICATE_KM = 0.1;

const SOCKETS: [string, string][] = [
  ['type2_combo', 'CCS2'],
  ['type2', 'Type2'],
  ['chademo', 'CHAdeMO'],
  ['gb_t', 'GBT'],
  ['gbt', 'GBT'],
  ['type1_combo', 'CCS1'],
];

/**
 * Chargers anywhere in India from OpenStreetMap (used without an Open Charge Map key), plus the
 * Pune demo chargers. OSM has no live status, price or (often) power, so those are UNKNOWN / 0
 * until someone reports. Results are saved to the database so reports and the detail screen work.
 */
export class OsmChargerAdapter extends MockChargerAdapter {
  async findNear(q: ChargerQuery): Promise<Charger[]> {
    const saved = await super.findNear(q);
    const refresh = this.refresh(q);
    if (saved.length >= ENOUGH_SAVED) return saved;
    await settleWithin(refresh, MAX_WAIT_MS);
    return super.findNear(q);
  }

  /** Fetches the area from OpenStreetMap and saves chargers not seen before. Never throws. */
  private async refresh(q: ChargerQuery) {
    try {
      const elements = await overpassAmenity(
        'charging_station',
        q.lat,
        q.lng,
        Math.min(q.radiusKm, FETCH_RADIUS_KM),
        150,
      );
      const demo = await prisma.charger.findMany({
        where: {
          NOT: { id: { startsWith: 'osm-' } },
          ...boxAround(q, FETCH_RADIUS_KM + 1),
        },
      });
      const rows = elements
        .map(osmChargerRow)
        .filter((r) => r.lat && !demo.some((d) => haversineKm(d, r) < DUPLICATE_KM));
      // Insert only new ones (one round trip each way): saved chargers keep crowd reports.
      const saved = await prisma.charger.findMany({
        where: { id: { in: rows.map((r) => r.id) } },
        select: { id: true },
      });
      const known = new Set(saved.map((r) => r.id));
      const fresh = rows.filter((r) => !known.has(r.id));
      if (fresh.length) await prisma.charger.createMany({ data: fresh });
    } catch (err) {
      console.warn('OpenStreetMap chargers unavailable, using saved ones:', (err as Error).message);
    }
  }
}

/** A Charger table row for an OSM charging station. */
export function osmChargerRow(e: OsmElement) {
  const tags = e.tags ?? {};
  const connectors = new Set<string>();
  for (const [osm, name] of SOCKETS) if (tags[`socket:${osm}`]) connectors.add(name);
  // "50 kW", "22kW;7.4 kW" -> the highest number.
  const outputs = Object.entries(tags)
    .filter(([k]) => /output$/.test(k))
    .flatMap(([, v]) => v.match(/\d+(\.\d+)?/g) ?? [])
    .map(Number);
  const { lat, lng } = elementPoint(e);
  return {
    id: `osm-${e.type[0]}${e.id}`,
    name: tags.name ?? tags.brand ?? tags.operator ?? 'EV charging station',
    operator: tags.operator ?? tags.brand ?? 'Unknown operator',
    lat,
    lng,
    powerKw: outputs.length ? Math.max(...outputs) : 0, // 0 = unknown
    connectors: JSON.stringify([...connectors]),
    status: 'UNKNOWN',
    pricePerKwh: 0, // unknown
    lastVerified: new Date(0),
  };
}
