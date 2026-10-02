import { prisma } from '../lib/db';
import type { Charger } from '../types';
import { MockChargerAdapter } from './chargers.mock';
import type { ChargerQuery } from './types';

interface OcmPoi {
  ID: number;
  AddressInfo: { Title: string; Latitude: number; Longitude: number };
  OperatorInfo?: { Title?: string } | null;
  StatusType?: { IsOperational?: boolean | null } | null;
  Connections?: { PowerKW?: number | null; ConnectionType?: { Title?: string } | null }[];
  UsageCost?: string | null;
  DateLastVerified?: string | null;
}

const CONNECTOR_NAMES: [RegExp, string][] = [
  [/ccs.*(2|type 2)|combo 2/i, 'CCS2'],
  [/type 2|mennekes/i, 'Type2'],
  [/chademo/i, 'CHAdeMO'],
  [/gb\/?t/i, 'GBT'],
  [/ac001|bharat/i, 'Bharat AC001'],
];

/**
 * Real chargers from Open Charge Map (used when OPEN_CHARGE_MAP_KEY is set).
 * Results are upserted into SQLite so crowd reports and charger detail work the same as the mock.
 */
export class OpenChargeMapAdapter extends MockChargerAdapter {
  constructor(private apiKey: string) {
    super();
  }

  async findNear(q: ChargerQuery): Promise<Charger[]> {
    const url = new URL('https://api.openchargemap.io/v3/poi/');
    url.search = new URLSearchParams({
      key: this.apiKey,
      latitude: String(q.lat),
      longitude: String(q.lng),
      distance: String(q.radiusKm),
      distanceunit: 'KM',
      maxresults: '100',
      compact: 'true',
      verbose: 'false',
    }).toString();

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Open Charge Map ${res.status}`);
      const pois = (await res.json()) as OcmPoi[];
      for (const poi of pois) {
        const id = `ocm-${poi.ID}`;
        const existing = await prisma.charger.findUnique({ where: { id } });
        const data = this.toRow(poi);
        // Keep crowd-reported status over OCM's (often stale) status.
        if (existing)
          await prisma.charger.update({
            where: { id },
            data: { ...data, status: existing.status },
          });
        else await prisma.charger.create({ data: { id, ...data } });
      }
    } catch (err) {
      console.warn('Open Charge Map unavailable, using cached chargers:', (err as Error).message);
    }
    return super.findNear(q);
  }

  private toRow(poi: OcmPoi) {
    const connections = poi.Connections ?? [];
    const connectors = new Set<string>();
    for (const c of connections) {
      const title = c.ConnectionType?.Title ?? '';
      const match = CONNECTOR_NAMES.find(([re]) => re.test(title));
      if (match) connectors.add(match[1]);
    }
    const price = Number(poi.UsageCost?.match(/\d+(\.\d+)?/)?.[0]);
    const operational = poi.StatusType?.IsOperational;
    return {
      name: poi.AddressInfo.Title,
      operator: poi.OperatorInfo?.Title ?? 'Unknown operator',
      lat: poi.AddressInfo.Latitude,
      lng: poi.AddressInfo.Longitude,
      powerKw: Math.max(0, ...connections.map((c) => c.PowerKW ?? 0)),
      connectors: JSON.stringify([...connectors]),
      status: operational === true ? 'WORKING' : operational === false ? 'BROKEN' : 'UNKNOWN',
      pricePerKwh: Number.isFinite(price) ? price : 18,
      lastVerified: poi.DateLastVerified ? new Date(poi.DateLastVerified) : new Date(0),
    };
  }
}
