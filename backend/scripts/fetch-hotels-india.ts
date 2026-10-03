/**
 * Builds data/hotels.india.json: real hotels (name, type, rating, reviews, nightly price range,
 * location, photo) for India's tourist destinations, from Xotelo (free TripAdvisor price data).
 * The holiday planner picks hotels from this file, then asks Xotelo for live rates for the
 * travel dates.
 *
 *   npx tsx scripts/fetch-hotels-india.ts
 *
 * 1. India-wide hotel lists reveal each locality's TripAdvisor id (the "g123" in hotel links).
 * 2. Every tourist destination below, plus any locality that shows up often in those lists,
 *    gets its top hotels downloaded.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'data', 'hotels.india.json');
const API = 'https://data.xotelo.com/api/list';
const INDIA = 'g293860';
/** Photo links are stored without this prefix to keep the file small. */
const IMAGE_BASE = 'https://dynamic-media-cdn.tripadvisor.com/media/';
const GAP_MS = 400;
/** Localities seen at least this often in the India-wide lists are included even if not below. */
const MIN_SEEN = 4;

/** Tourist destinations; extra names are TripAdvisor's spellings. */
const DESTINATIONS: string[][] = [
  // Rajasthan
  ['Jaipur'],
  ['Udaipur'],
  ['Jodhpur'],
  ['Jaisalmer'],
  ['Bikaner'],
  ['Pushkar'],
  ['Ajmer'],
  ['Mount Abu'],
  ['Chittorgarh'],
  ['Sawai Madhopur', 'Ranthambore'],
  ['Bundi'],
  ['Kumbhalgarh'],
  ['Mandawa'],
  ['Neemrana'],
  // North
  ['New Delhi', 'Delhi'],
  ['Agra'],
  ['Mathura'],
  ['Vrindavan'],
  ['Varanasi'],
  ['Lucknow'],
  ['Ayodhya'],
  ['Prayagraj', 'Allahabad'],
  ['Amritsar'],
  ['Chandigarh'],
  ['Shimla'],
  ['Manali'],
  ['Dharamsala', 'Dharamshala'],
  ['McLeod Ganj'],
  ['Dalhousie'],
  ['Kasol'],
  ['Kasauli'],
  ['Kufri'],
  ['Bir'],
  ['Leh'],
  ['Srinagar'],
  ['Gulmarg'],
  ['Pahalgam'],
  ['Sonamarg'],
  ['Jammu'],
  ['Katra'],
  ['Rishikesh'],
  ['Haridwar'],
  ['Mussoorie'],
  ['Nainital'],
  ['Dehradun'],
  ['Ramnagar', 'Jim Corbett'],
  ['Auli'],
  ['Almora'],
  ['Ranikhet'],
  ['Kausani'],
  ['Lansdowne'],
  ['Mukteshwar'],
  ['Bhimtal'],
  // West
  ['Mumbai'],
  ['Pune'],
  ['Lonavala'],
  ['Mahabaleshwar'],
  ['Panchgani'],
  ['Matheran'],
  ['Alibag'],
  ['Nashik'],
  ['Shirdi'],
  ['Aurangabad'],
  ['Ahmedabad'],
  ['Vadodara'],
  ['Dwarka'],
  ['Somnath'],
  ['Bhuj'],
  ['Diu'],
  ['Daman'],
  ['Saputara'],
  ['Kolhapur'],
  ['Ratnagiri'],
  ['Ganpatipule'],
  ['Tarkarli', 'Malvan'],
  // Goa
  ['Panjim', 'Panaji'],
  ['Calangute'],
  ['Candolim'],
  ['Baga'],
  ['Anjuna'],
  ['Vagator'],
  ['Arambol'],
  ['Morjim'],
  ['Colva'],
  ['Benaulim'],
  ['Palolem'],
  ['Margao'],
  ['Agonda'],
  ['Majorda'],
  ['Cavelossim'],
  ['Bardez'],
  ['Sinquerim'],
  ['Arpora'],
  ['Siolim'],
  // South
  ['Bengaluru', 'Bangalore'],
  ['Mysuru', 'Mysore'],
  ['Madikeri', 'Coorg'],
  ['Chikmagalur'],
  ['Hampi'],
  ['Gokarna'],
  ['Udupi'],
  ['Mangalore', 'Mangaluru'],
  ['Hyderabad'],
  ['Chennai'],
  ['Mahabalipuram', 'Mamallapuram'],
  ['Pondicherry', 'Puducherry'],
  ['Ooty', 'Udhagamandalam'],
  ['Kodaikanal'],
  ['Coonoor'],
  ['Madurai'],
  ['Rameswaram'],
  ['Kanyakumari'],
  ['Thanjavur'],
  ['Yercaud'],
  ['Kochi', 'Cochin'],
  ['Munnar'],
  ['Thekkady', 'Kumily'],
  ['Alappuzha', 'Alleppey'],
  ['Kumarakom'],
  ['Varkala'],
  ['Kovalam'],
  ['Thiruvananthapuram', 'Trivandrum'],
  ['Kalpetta', 'Wayanad'],
  ['Vythiri'],
  ['Tirupati'],
  ['Visakhapatnam'],
  ['Araku Valley'],
  ['Kozhikode', 'Calicut'],
  ['Thrissur'],
  ['Kannur'],
  ['Bekal'],
  ['Sakleshpur'],
  ['Dandeli'],
  ['Kabini'],
  // East and North-East
  ['Kolkata', 'Calcutta'],
  ['Darjeeling'],
  ['Gangtok'],
  ['Pelling'],
  ['Lachung'],
  ['Kalimpong'],
  ['Shillong'],
  ['Cherrapunjee', 'Cherrapunji', 'Sohra'],
  ['Guwahati'],
  ['Kaziranga'],
  ['Tawang'],
  ['Puri'],
  ['Bhubaneswar'],
  ['Konark'],
  ['Bodh Gaya'],
  ['Patna'],
  ['Siliguri'],
  ['Port Blair'],
  ['Havelock Island', 'Swaraj Dweep'],
  ['Neil Island', 'Shaheed Dweep'],
  ['Digha'],
  ['Mirik'],
  ['Imphal'],
  ['Kohima'],
  ['Aizawl'],
  ['Agartala'],
  ['Ziro'],
  // Central
  ['Khajuraho'],
  ['Bhopal'],
  ['Indore'],
  ['Ujjain'],
  ['Pachmarhi'],
  ['Gwalior'],
  ['Orchha'],
  ['Mandu'],
  ['Jabalpur'],
  ['Raipur'],
  ['Ranchi'],
  ['Kanha'],
  ['Bandhavgarh'],
  ['Omkareshwar'],
];

interface XoteloHotel {
  name: string;
  key: string;
  accommodation_type: string;
  url: string;
  review_summary?: { rating?: number; count?: number };
  price_ranges?: { maximum?: number; minimum?: number };
  geo?: { latitude: number; longitude: number };
  image?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function list(locationKey: string, offset: number, sort: string) {
  const url = `${API}?location_key=${locationKey}&limit=100&offset=${offset}&sort=${sort}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      const json = (await res.json()) as {
        error: { message: string } | null;
        result: { total_count: number; list: XoteloHotel[] } | null;
      };
      await sleep(GAP_MS);
      if (json.error) throw new Error(json.error.message);
      return json.result!;
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error('unreachable');
}

/** "…-Reviews-Le_Meridien_Goa_Calangute-Calangute_North_Goa_District_Goa.html" → geo + area. */
function locality(h: XoteloHotel) {
  const geo = /Hotel_Review-(g\d+)-/.exec(h.url)?.[1];
  const slug =
    h.url
      .replace(/\.html$/, '')
      .split('-')
      .pop() ?? '';
  return geo ? { geo, slug } : null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '_');

async function main() {
  // 1. Discover localities from the India-wide lists (each list is capped at 3,000 hotels).
  const seen = new Map<string, { slug: string; count: number }>();
  for (const sort of ['popularity', 'best_value']) {
    for (let offset = 0; offset < 3000; offset += 100) {
      const page = await list(INDIA, offset, sort).catch((e: Error) => {
        console.warn(`  India ${sort} @${offset}: ${e.message}`);
        return null;
      });
      if (!page?.list.length) break;
      for (const h of page.list) {
        const loc = locality(h);
        if (!loc) continue;
        const s = seen.get(loc.geo) ?? { slug: loc.slug, count: 0 };
        s.count++;
        seen.set(loc.geo, s);
      }
    }
    console.log(`discovered ${seen.size} localities after "${sort}"`);
  }

  // 2. Match destinations to localities ("Calangute_North_Goa_District_Goa" starts with "calangute").
  const targets = new Map<string, { name: string; area: string }>();
  const missing: string[] = [];
  for (const names of DESTINATIONS) {
    const hit = [...seen.entries()]
      .filter(([, s]) => names.some((n) => `${norm(s.slug)}_`.startsWith(`${norm(n)}_`)))
      .sort((a, b) => b[1].count - a[1].count)[0];
    if (hit) targets.set(hit[0], { name: names[0], area: hit[1].slug.replace(/_/g, ' ') });
    else missing.push(names[0]);
  }
  for (const [geo, s] of seen)
    if (s.count >= MIN_SEEN && !targets.has(geo))
      targets.set(geo, { name: s.slug.split('_')[0], area: s.slug.replace(/_/g, ' ') });
  console.log(`${targets.size} destinations; not found in the India lists: ${missing.join(', ')}`);

  // 3. Top hotels for each destination (up to 200 for big ones).
  const hotels = new Map<string, unknown>();
  const cities: { geo: string; name: string; area: string; hotels: number }[] = [];
  let done = 0;
  for (const [geo, t] of targets) {
    let got = 0;
    for (let offset = 0; offset < 200; offset += 100) {
      const page = await list(geo, offset, 'popularity').catch((e: Error) => {
        console.warn(`  ${t.name}: ${e.message}`);
        return null;
      });
      if (!page) break;
      for (const h of page.list) {
        // Hotels without a price can't go in a budget.
        if (!h.geo || !h.price_ranges?.minimum || hotels.has(h.key.split('-').pop()!)) continue;
        hotels.set(h.key.split('-').pop()!, {
          k: h.key,
          n: h.name,
          t: h.accommodation_type,
          r: h.review_summary?.rating ?? null,
          c: h.review_summary?.count ?? 0,
          lo: h.price_ranges?.minimum ?? null,
          hi: h.price_ranges?.maximum ?? null,
          lat: Math.round(h.geo.latitude * 1e5) / 1e5,
          lng: Math.round(h.geo.longitude * 1e5) / 1e5,
          img: h.image?.startsWith(IMAGE_BASE)
            ? h.image.slice(IMAGE_BASE.length)
            : (h.image ?? null),
          u: h.url.replace('https://www.tripadvisor.com/Hotel_Review-', ''),
          g: geo,
        });
        got++;
      }
      if (page.total_count <= offset + 100) break;
    }
    cities.push({ geo, name: t.name, area: t.area, hotels: got });
    if (++done % 10 === 0)
      console.log(`  ${done}/${targets.size} destinations, ${hotels.size} hotels`);
  }

  writeFileSync(
    OUT,
    JSON.stringify({
      source: 'Xotelo (TripAdvisor) via data.xotelo.com',
      fetchedAt: new Date().toISOString(),
      priceCurrency: 'USD',
      imageBase: IMAGE_BASE,
      cities,
      hotels: [...hotels.values()],
    }),
  );
  console.log(`wrote ${cities.length} destinations and ${hotels.size} hotels to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
