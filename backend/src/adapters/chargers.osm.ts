import { prisma } from '../lib/db';
import { haversineKm } from '../lib/geo';
import { elementPoint, overpassAmenity, type OsmElement } from '../lib/osm';
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
 * until someone reports. Results are saved to SQLite so reports and the detail screen work.
 */
export class OsmChargerAdapter extends MockChargerAdapter {
  async findNear(q: ChargerQuery): Promise<Charger[]> {
    try {
      const elements = await overpassAmenity(
        'charging_station',
        q.lat,
        q.lng,
        Math.min(q.radiusKm, FETCH_RADIUS_KM),
        150,
      );
      const demo = await prisma.charger.findMany({
        where: { NOT: { id: { startsWith: 'osm-' } } },
      });
      for (const e of elements) {
        const { id, ...row } = osmChargerRow(e);
        if (!row.lat || demo.some((d) => haversineKm(d, row) < DUPLICATE_KM)) continue;
        // Keep crowd-reported status and verification time across refreshes.
        await prisma.charger.upsert({
          where: { id },
          create: { id, ...row },
          update: {
            name: row.name,
            operator: row.operator,
            powerKw: row.powerKw,
            connectors: row.connectors,
          },
        });
      }
    } catch (err) {
      console.warn('OpenStreetMap chargers unavailable, using saved ones:', (err as Error).message);
    }
    return super.findNear(q);
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
