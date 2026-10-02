/**
 * OpenStreetMap lookups for places outside the demo data: Nominatim for place names and
 * Overpass for chargers and parking. Both are free and keyless; results are cached and
 * Nominatim is limited to one request a second, as its usage policy asks.
 */
import type { Place } from '../types';
import { haversineKm } from './geo';

const USER_AGENT = 'SafarSathi/1.0 (hackathon travel copilot)';
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
/** Within this distance of a demo place, an OSM place takes that place's city (for transit). */
const SNAP_CITY_KM = 40;

// ----------------------------------------------------------------- Nominatim

interface NominatimRow {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
}

const placeCache = new Map<string, Place[]>();
let lastNominatimCall = 0;

async function nominatimSlot() {
  const wait = lastNominatimCall + 1100 - Date.now();
  lastNominatimCall = Math.max(Date.now(), lastNominatimCall + 1100);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

function placeType(row: NominatimRow): Place['type'] {
  if (row.type === 'aerodrome') return 'AIRPORT';
  if (row.category === 'railway' || row.type === 'station') return 'STATION';
  if (row.type === 'bus_station') return 'BUS_STAND';
  if (row.type === 'mall') return 'MALL';
  if (
    ['city', 'town', 'village', 'suburb', 'neighbourhood', 'administrative'].includes(
      row.type ?? '',
    )
  )
    return 'AREA';
  return 'LANDMARK';
}

/** Places in India matching `query`, best first. `known` lets nearby results reuse demo cities. */
export async function searchOsmPlaces(query: string, known: Place[], limit = 5): Promise<Place[]> {
  const key = `${query.trim().toLowerCase()}|${limit}`;
  const cached = placeCache.get(key);
  if (cached) return cached;

  await nominatimSlot();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q: query,
    countrycodes: 'in',
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
  }).toString();
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const rows = (await res.json()) as NominatimRow[];

  const places = rows.map((row): Place => {
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    const a = row.address ?? {};
    let city = (
      a.city ??
      a.town ??
      a.village ??
      a.state_district ??
      a.county ??
      a.state ??
      'Unknown'
    ).replace(/\s+(Municipal Corporation|Municipal Council|Nagar Nigam|Cantonment Board)$/i, '');
    const nearest = known.reduce<{ p: Place; d: number } | null>((best, p) => {
      const d = haversineKm({ lat, lng }, p);
      return !best || d < best.d ? { p, d } : best;
    }, null);
    if (nearest && nearest.d < SNAP_CITY_KM) city = nearest.p.city;
    return {
      id: `osm-${row.osm_type[0]}${row.osm_id}`,
      name: row.name || row.display_name.split(',')[0],
      city,
      lat,
      lng,
      type: placeType(row),
      aliases: [],
    };
  });
  placeCache.set(key, places);
  return places;
}

// ------------------------------------------------------------------ Overpass

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const overpassCache = new Map<string, { at: number; elements: OsmElement[] }>();
const OVERPASS_TTL_MS = 6 * 60 * 60_000;
/** After a failed lookup, don't retry the same area for this long, so screens don't stall. */
const FAILURE_TTL_MS = 3 * 60_000;
const failedAt = new Map<string, number>();
/** One request at a time: the public servers allow only two concurrent queries per IP. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Elements tagged amenity=`amenity` within `radiusKm` of a point. Cached per ~1 km cell, so
 * repeated screen loads don't hit the public servers. Throws if every mirror fails.
 */
export async function overpassAmenity(
  amenity: string,
  lat: number,
  lng: number,
  radiusKm: number,
  limit: number,
): Promise<OsmElement[]> {
  const key = `${amenity}|${lat.toFixed(2)},${lng.toFixed(2)}|${radiusKm}`;
  const hit = overpassCache.get(key);
  if (hit && Date.now() - hit.at < OVERPASS_TTL_MS) return hit.elements;
  if (Date.now() - (failedAt.get(key) ?? 0) < FAILURE_TTL_MS)
    throw new Error('Overpass failed recently for this area');

  const run = queue.then(() => fetchOverpass(key, amenity, lat, lng, radiusKm, limit));
  queue = run.catch(() => undefined);
  return run;
}

async function fetchOverpass(
  key: string,
  amenity: string,
  lat: number,
  lng: number,
  radiusKm: number,
  limit: number,
): Promise<OsmElement[]> {
  // Another queued request may have fetched this area meanwhile.
  const hit = overpassCache.get(key);
  if (hit) return hit.elements;

  const r = Math.round(radiusKm * 1000);
  const query = `[out:json][timeout:15];nwr["amenity"="${amenity}"](around:${r},${lat},${lng});out center ${limit};`;
  let lastError: unknown;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const body = (await res.json()) as { elements: OsmElement[] };
      overpassCache.set(key, { at: Date.now(), elements: body.elements });
      return body.elements;
    } catch (err) {
      lastError = err;
    }
  }
  failedAt.set(key, Date.now());
  throw lastError;
}

export const elementPoint = (e: OsmElement) => ({
  lat: e.lat ?? e.center?.lat ?? 0,
  lng: e.lon ?? e.center?.lon ?? 0,
});

/**
 * Waits for `p` at most `ms`; never throws. Lets a request answer from the database while a
 * slow OpenStreetMap refresh carries on in the background.
 */
export const settleWithin = (p: Promise<unknown>, ms: number) =>
  Promise.race([p.catch(() => undefined), new Promise((r) => setTimeout(r, ms))]);

/** Saved results this many or more: answer at once and refresh in the background. */
export const ENOUGH_SAVED = 3;
/** With fewer saved results, wait this long for OpenStreetMap before answering. */
export const MAX_WAIT_MS = 6000;
