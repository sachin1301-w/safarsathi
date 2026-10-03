// Picks a real adapter when its key is configured, otherwise the offline mock.
import { MockBookingAdapter } from './booking.mock';
import { MockChargerAdapter } from './chargers.mock';
import { OpenChargeMapAdapter } from './chargers.openchargemap';
import { OsmChargerAdapter } from './chargers.osm';
import { MockGeocodeAdapter } from './geocode.mock';
import { CogneeMemoryAdapter, LocalMemoryAdapter } from './memory.cognee';
import { MockParkingAdapter } from './parking.mock';
import { OsmParkingAdapter } from './parking.osm';
import { MockScheduleAdapter } from './schedules.mock';
import { NoSpeechAdapter, SarvamSpeechAdapter } from './speech.sarvam';
import { MockTransitAdapter } from './transit.mock';
import { haversineKm } from '../lib/geo';
import { touristPlace } from '../lib/hotels';
import { searchOsmPlaces } from '../lib/osm';
import { wikiPlace } from '../lib/wiki';
import type { Place } from '../types';
import type {
  BookingAdapter,
  ChargerAdapter,
  GeocodeAdapter,
  MemoryAdapter,
  ParkingAdapter,
  ScheduleAdapter,
  SpeechAdapter,
  TransitAdapter,
} from './types';

const env = (name: string) => process.env[name]?.trim() || undefined;

export const geocode: GeocodeAdapter = new MockGeocodeAdapter();
export const transit: TransitAdapter = new MockTransitAdapter();
export const schedules: ScheduleAdapter = new MockScheduleAdapter();
export const booking: BookingAdapter = new MockBookingAdapter();
/** DEMO_OFFLINE=true keeps chargers and parking to the seeded Pune data (no internet needed). */
const offline = process.env.DEMO_OFFLINE?.trim().toLowerCase() === 'true';

export const parking: ParkingAdapter = offline ? new MockParkingAdapter() : new OsmParkingAdapter();

const ocmKey = env('OPEN_CHARGE_MAP_KEY');
export const chargers: ChargerAdapter = offline
  ? new MockChargerAdapter()
  : ocmKey
    ? new OpenChargeMapAdapter(ocmKey)
    : new OsmChargerAdapter();

const sarvamKey = env('SARVAM_API_KEY');
export const speech: SpeechAdapter = sarvamKey
  ? new SarvamSpeechAdapter(sarvamKey)
  : new NoSpeechAdapter();

const cogneeUrl = env('COGNEE_API_URL');
const cogneeKey = env('COGNEE_API_KEY');
export const memory: MemoryAdapter =
  cogneeUrl && cogneeKey
    ? new CogneeMemoryAdapter(cogneeUrl.replace(/\/$/, ''), cogneeKey)
    : new LocalMemoryAdapter();

export function describeAdapters() {
  const llm =
    process.env.DEMO_OFFLINE?.trim().toLowerCase() === 'true'
      ? 'offline'
      : process.env.LLM_PROVIDER?.trim() ||
        (process.env.ANTHROPIC_API_KEY?.trim()
          ? 'claude'
          : env('GEMINI_API_KEY')
            ? 'gemini'
            : sarvamKey
              ? 'sarvam'
              : 'offline');
  return {
    llm,
    chargers: offline ? 'mock' : ocmKey ? 'open-charge-map' : 'openstreetmap',
    parking: offline ? 'mock' : 'openstreetmap',
    speech: sarvamKey ? 'sarvam' : 'on-device',
    memory: cogneeUrl && cogneeKey ? 'cognee' : 'local',
  };
}

/** Demo places first, then OpenStreetMap for anywhere else in India. */
export async function findPlaces(query: string, limit = 6): Promise<Place[]> {
  const local = geocode.search(query, limit);
  if (local.length >= limit || query.trim().length < 3) return local;
  try {
    const online = await searchOsmPlaces(query, geocode.all(), limit);
    // Skip online results that duplicate a demo place.
    const fresh = online.filter((o) => !local.some((l) => haversineKm(l, o) < 1));
    return [...local, ...fresh].slice(0, limit);
  } catch (err) {
    console.warn('Online place search failed:', (err as Error).message);
    return local;
  }
}

/**
 * One place for a name: a close demo match, else OpenStreetMap, else (when that free service is
 * busy or down) our tourist places from the hotel list, then Wikipedia, then a loose demo match.
 */
export async function lookupPlace(query: string): Promise<Place | null> {
  const strict = geocode.resolve(query, { strict: true });
  if (strict) return strict;
  // Tried twice: the public OpenStreetMap search is sometimes slow or rate-limited.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const online = await searchOsmPlaces(query, geocode.all(), 1);
      if (online[0]) return online[0];
      break;
    } catch (err) {
      console.warn(`Place search for "${query}" failed:`, (err as Error).message);
    }
  }
  const town = touristPlace(query);
  if (town) return town;
  const wiki = await wikiPlace(query).catch(() => null);
  if (wiki)
    return {
      id: `wiki-${wiki.pageId}`,
      name: wiki.name,
      city: wiki.name,
      lat: wiki.lat,
      lng: wiki.lng,
      type: 'AREA',
      aliases: [],
    };
  return geocode.resolve(query);
}
