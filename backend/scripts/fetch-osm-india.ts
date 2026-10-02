/**
 * Downloads EV chargers for all of India and public parking around major cities from
 * OpenStreetMap, into data/chargers.india.json and data/parking.india.json. The seed loads
 * these, so all-India data works even when the public Overpass servers are slow.
 *
 *   npx tsx scripts/fetch-osm-india.ts            # both
 *   npx tsx scripts/fetch-osm-india.ts parking    # one
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { osmChargerRow } from '../src/adapters/chargers.osm';
import { osmParkingRow } from '../src/adapters/parking.osm';
import type { OsmElement } from '../src/lib/osm';

const DATA_DIR = join(import.meta.dirname, '..', 'data');
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const PARKING_RADIUS_M = 8000;

/** City centres; Pune is left out because its parking is curated demo data. */
const CITIES: [string, number, number][] = [
  ['Mumbai', 19.076, 72.8777],
  ['Thane', 19.2183, 72.9781],
  ['Navi Mumbai', 19.033, 73.0297],
  ['Delhi', 28.6315, 77.2167],
  ['Gurugram', 28.4595, 77.0266],
  ['Noida', 28.5355, 77.391],
  ['Bengaluru', 12.9716, 77.5946],
  ['Hyderabad', 17.385, 78.4867],
  ['Chennai', 13.0827, 80.2707],
  ['Kolkata', 22.5726, 88.3639],
  ['Ahmedabad', 23.0225, 72.5714],
  ['Surat', 21.1702, 72.8311],
  ['Vadodara', 22.3072, 73.1812],
  ['Jaipur', 26.9124, 75.7873],
  ['Jodhpur', 26.2389, 73.0243],
  ['Udaipur', 24.5854, 73.7125],
  ['Bikaner', 28.0229, 73.3119],
  ['Lucknow', 26.8467, 80.9462],
  ['Kanpur', 26.4499, 80.3319],
  ['Varanasi', 25.3176, 82.9739],
  ['Agra', 27.1767, 78.0081],
  ['Chandigarh', 30.7333, 76.7794],
  ['Amritsar', 31.634, 74.8723],
  ['Dehradun', 30.3165, 78.0322],
  ['Indore', 22.7196, 75.8577],
  ['Bhopal', 23.2599, 77.4126],
  ['Nagpur', 21.1458, 79.0882],
  ['Nashik', 19.9975, 73.7898],
  ['Aurangabad', 19.8762, 75.3433],
  ['Kolhapur', 16.705, 74.2433],
  ['Goa (Panaji)', 15.4909, 73.8278],
  ['Mysuru', 12.2958, 76.6394],
  ['Mangaluru', 12.9141, 74.856],
  ['Kochi', 9.9312, 76.2673],
  ['Thiruvananthapuram', 8.5241, 76.9366],
  ['Coimbatore', 11.0168, 76.9558],
  ['Madurai', 9.9252, 78.1198],
  ['Visakhapatnam', 17.6868, 83.2185],
  ['Vijayawada', 16.5062, 80.648],
  ['Bhubaneswar', 20.2961, 85.8245],
  ['Patna', 25.5941, 85.1376],
  ['Ranchi', 23.3441, 85.3096],
  ['Guwahati', 26.1445, 91.7362],
  ['Raipur', 21.2514, 81.6296],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(query: string): Promise<OsmElement[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const mirror = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: {
          'User-Agent': 'SafarSathi/1.0 (hackathon travel copilot)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(200_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as { elements: OsmElement[] }).elements;
    } catch (err) {
      console.warn(`  ${mirror.split('/')[2]} failed (${(err as Error).message}), retrying…`);
      await sleep(10_000 * (attempt + 1));
    }
  }
  throw new Error('Overpass failed after 6 attempts');
}

async function chargers() {
  console.log('Chargers: all of India…');
  const els = await overpass(
    '[out:json][timeout:180];area["ISO3166-1"="IN"][admin_level=2]->.in;' +
      'nwr["amenity"="charging_station"](area.in);out center tags;',
  );
  const rows = els.map(osmChargerRow).filter((r) => r.lat);
  writeFileSync(join(DATA_DIR, 'chargers.india.json'), JSON.stringify(rows));
  console.log(`  saved ${rows.length} chargers`);
}

type LotRow = NonNullable<ReturnType<typeof osmParkingRow>>;

async function parking() {
  // Resumable: saved after every city, and cities already in the file are skipped.
  const file = join(DATA_DIR, 'parking.india.json');
  const progressFile = join(DATA_DIR, '.parking.india.progress.json');
  const byId = new Map<string, LotRow>(
    existsSync(file)
      ? (JSON.parse(readFileSync(file, 'utf8')) as LotRow[]).map((r) => [r.id, r])
      : [],
  );
  const done = new Set<string>(
    existsSync(progressFile) ? (JSON.parse(readFileSync(progressFile, 'utf8')) as string[]) : [],
  );
  for (const [name, lat, lng] of CITIES) {
    if (done.has(name)) continue;
    try {
      const els = await overpass(
        `[out:json][timeout:60];nwr["amenity"="parking"](around:${PARKING_RADIUS_M},${lat},${lng});out center 400;`,
      );
      let added = 0;
      for (const e of els) {
        const row = osmParkingRow(e);
        if (row?.lat && !byId.has(row.id)) {
          byId.set(row.id, row);
          added++;
        }
      }
      console.log(`Parking: ${name} +${added}`);
      done.add(name);
      writeFileSync(file, JSON.stringify([...byId.values()]));
      writeFileSync(progressFile, JSON.stringify([...done]));
    } catch (err) {
      console.warn(`Parking: ${name} skipped (${(err as Error).message})`);
    }
    await sleep(3000); // stay well inside the public servers' rate limits
  }
  console.log(`  saved ${byId.size} parking lots (${done.size}/${CITIES.length} cities)`);
}

const only = process.argv[2];
if (!only || only === 'chargers') await chargers();
if (!only || only === 'parking') await parking();
