/**
 * Notable places near a point from Wikipedia: name, short description, photo, a two-sentence
 * summary and recent page views (used to rank famous sights first). Fast (~1-2 s) and keyless.
 * Wikimedia rate-limits busy clients, so requests go one at a time with a short gap, results are
 * cached, and the app identifies itself as its usage policy asks.
 */
const API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'SafarSathi/1.0 (https://github.com/sachin1301-w/safarsathi; travel copilot)';
const GAP_MS = 250;
let queue: Promise<unknown> = Promise.resolve();

export interface WikiPlace {
  pageId: number;
  name: string;
  description: string;
  summary: string;
  lat: number;
  lng: number;
  photo?: string;
  url: string;
  views: number;
}

/** Descriptions that mark a place worth visiting... */
const SIGHT =
  /\b(fort|palace|temple|beach|museum|lake|park|church|mosque|monument|garden|zoo|waterfalls?|tomb|market|bazaar|caves?|hill|dam|mahal|observatory|gate|ghat|basilica|cathedral|sanctuary|national park|island|viewpoint|stepwell|memorial|heritage|landmark|attraction|shrine|gurdwara|monastery|mausoleum|aquarium|planetarium|lighthouse|bay|valley|reservoir|haveli|world heritage)\b/i;
/** ...and ones that don't, even if they mention a sight. */
const NOT_SIGHT =
  /\b(hospital|school|college|university|institute|railway station|metro station|airport|company|bank|office|constituency|neighbourhood|suburb|village|district|ward|stadium|hotel chain|film|novel|album)\b/i;

const cache = new Map<string, WikiPlace[]>();
const hotelCache = new Map<string, WikiPlace[]>();
const HOTEL = /\b(hotel|resort|heritage hotel|palace hotel)\b/i;

function call(params: Record<string, string>) {
  const run = queue.then(async () => {
    const out = await request(params);
    await new Promise((r) => setTimeout(r, GAP_MS));
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

async function request(params: Record<string, string>) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const text = await res.text();
  // A rate-limit reply is plain text, not JSON.
  if (!text.startsWith('{'))
    throw new Error('Wikipedia is rate-limiting requests; try again shortly');
  return JSON.parse(text) as {
    query?: {
      pages?: {
        pageid: number;
        title: string;
        description?: string;
        extract?: string;
        thumbnail?: { source: string };
        coordinates?: { lat: number; lon: number }[];
        pageviews?: Record<string, number | null>;
      }[];
    };
  };
}

/** Sights within `radiusKm` (max 10 per request) of each point, most visited first. */
export async function sightsNear(points: { lat: number; lng: number }[], radiusKm = 10) {
  const key =
    points.map((p) => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`).join(';') + `|${radiusKm}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const r = String(Math.min(10_000, Math.round(radiusKm * 1000)));
  const batches = [];
  for (const p of points) {
    batches.push(
      await call({
        action: 'query',
        generator: 'geosearch',
        ggscoord: `${p.lat}|${p.lng}`,
        ggsradius: r,
        ggslimit: '50',
        prop: 'description|pageimages|coordinates|pageviews',
        colimit: 'max',
        pilimit: 'max',
        piprop: 'thumbnail',
        pithumbsize: '480',
        pvipdays: '30',
      }).catch(() => ({ query: { pages: [] } })),
    );
  }
  const byId = new Map<number, WikiPlace>();
  const hotels = new Map<number, WikiPlace>();
  for (const b of batches) {
    for (const p of b.query?.pages ?? []) {
      const desc = p.description ?? '';
      const text = `${p.title} ${desc}`;
      // Notable hotels (e.g. heritage palace hotels) are kept separately for luxury stays.
      if (HOTEL.test(desc) && p.coordinates?.length)
        hotels.set(p.pageid, {
          pageId: p.pageid,
          name: p.title.replace(/,\s*[A-Z][\w ]+$/, ''),
          description: desc,
          summary: '',
          lat: p.coordinates[0].lat,
          lng: p.coordinates[0].lon,
          photo: p.thumbnail?.source,
          url: `https://en.wikipedia.org/?curid=${p.pageid}`,
          views: 0,
        });
      if (!SIGHT.test(text) || NOT_SIGHT.test(desc) || !p.coordinates?.length) continue;
      const views = Object.values(p.pageviews ?? {}).reduce<number>((s, v) => s + (v ?? 0), 0);
      byId.set(p.pageid, {
        pageId: p.pageid,
        name: p.title.replace(/,\s*[A-Z][\w ]+$/, ''),
        description: desc,
        summary: '',
        lat: p.coordinates[0].lat,
        lng: p.coordinates[0].lon,
        photo: p.thumbnail?.source,
        url: `https://en.wikipedia.org/?curid=${p.pageid}`,
        views,
      });
    }
  }
  // Wikipedia gives page views for only some pages per request; fetch the rest so famous sights
  // (e.g. Lake Pichola) rank properly. Pages that already have views keep them.
  const missing = [...byId.values()].filter((p) => p.views === 0).map((p) => p.pageId);
  for (let i = 0; i < missing.length && i < 80; i += 20) {
    let cont: Record<string, string> = {};
    for (let round = 0; round < 3; round++) {
      const res = await call({
        action: 'query',
        pageids: missing.slice(i, i + 20).join('|'),
        prop: 'pageviews',
        pvipdays: '30',
        ...cont,
      }).catch(() => null);
      for (const p of res?.query?.pages ?? []) {
        const views = Object.values(p.pageviews ?? {}).reduce<number>((s, v) => s + (v ?? 0), 0);
        const place = byId.get(p.pageid);
        if (place && views) place.views = views;
      }
      const next = (res as { continue?: Record<string, string> } | null)?.continue;
      if (!next?.pvipcontinue) break;
      cont = next;
    }
  }
  const places = [...byId.values()].sort((a, b) => b.views - a.views);

  // Two-sentence summaries for the top places (the API gives at most 20 intros per request).
  const top = places.slice(0, 20);
  if (top.length) {
    const intro = await call({
      action: 'query',
      pageids: top.map((p) => p.pageId).join('|'),
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      exsentences: '2',
      exlimit: '20',
    }).catch(() => ({ query: { pages: [] } }));
    for (const p of intro.query?.pages ?? []) {
      const place = byId.get(p.pageid);
      if (place && p.extract) place.summary = p.extract.replace(/\s*\([^)]*\)/g, '').trim();
    }
  }
  cache.set(key, places);
  hotelCache.set(key, [...hotels.values()]);
  return places;
}

/** India's rough bounding box, to reject same-named places abroad. */
const inIndia = (lat: number, lng: number) => lat > 6 && lat < 37.6 && lng > 68 && lng < 97.5;

/** A place's coordinates from its Wikipedia article ("Udaipur" → the city), if it's in India. */
export async function wikiPlace(name: string) {
  const res = await call({
    action: 'query',
    titles: name.trim(),
    redirects: '1',
    prop: 'coordinates|description',
  });
  const page = res.query?.pages?.[0];
  const c = page?.coordinates?.[0];
  if (!page || !c || !inIndia(c.lat, c.lon)) return null;
  const title = page.title.replace(/,\s*[A-Z][\w ]+$/, '');
  return { pageId: page.pageid, name: title, lat: c.lat, lng: c.lon };
}

/** Notable hotels found by the last sightsNear() call for the same points. */
export function notableHotels(points: { lat: number; lng: number }[], radiusKm = 10) {
  const key =
    points.map((p) => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`).join(';') + `|${radiusKm}`;
  return hotelCache.get(key) ?? [];
}
