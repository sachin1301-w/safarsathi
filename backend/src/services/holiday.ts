/**
 * Holiday planner: "N days in <place>" → the special places to see (Wikipedia, famous first), a
 * day-by-day plan grouping nearby sights, and three tiers (budget, comfort, luxury), each with real
 * hotels (TripAdvisor data with live rates for the dates; OpenStreetMap or estimates where there
 * is none), travel there and back (our journey planner) and a full budget. Every price that isn't
 * real data is an estimate and is labelled so. Gemini only writes the overview and tips.
 */
import { lookupPlace } from '../adapters';
import { postCompletion } from '../ai/completion';
import { haversineKm } from '../lib/geo';
import { hotelsByTier, liveRate, type DataHotel } from '../lib/hotels';
import { HttpError } from '../lib/http';
import { elementPoint, overpassQuery } from '../lib/osm';
import { notableHotels, sightsNear, type WikiPlace } from '../lib/wiki';
import type { Place, Point } from '../types';
import { travelForStyle, type TierTravel } from './holidayTravel';
import { planForUser } from './trips';

export type HolidayStyle = 'budget' | 'comfort' | 'luxury';

export interface HolidayRequest {
  destination: string;
  days: number;
  travellers: number;
  style: HolidayStyle;
  /** Where the trip starts; defaults to the user's home. */
  from?: string | Point;
  startDate?: Date;
}

export interface Sight {
  name: string;
  description: string;
  summary: string;
  category: string;
  lat: number;
  lng: number;
  photo?: string;
  url: string;
  /** Estimated entry ticket per person, INR (0 = usually free). */
  ticket: number;
}

export interface HolidayDay {
  day: number;
  title: string;
  sights: Sight[];
  distanceKm: number;
}

export interface HotelOption {
  id: string;
  name: string;
  kind: string;
  stars?: number;
  lat: number;
  lng: number;
  pricePerNight: number;
  nights: number;
  rooms: number;
  total: number;
  /**
   * "tripadvisor": a real listed hotel with real prices; "openstreetmap": a real hotel with an
   * estimated price; "estimate": no hotel data nearby.
   */
  source: 'tripadvisor' | 'openstreetmap' | 'estimate';
  /** "live": the rate for these dates on a booking site; "range": its usual price; "estimate". */
  priceSource: 'live' | 'range' | 'estimate';
  /** Booking site with the cheapest live rate, and the best few offers. */
  provider?: string;
  offers?: { name: string; rate: number }[];
  /** Usual nightly range (INR) from TripAdvisor. */
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  reviews?: number;
  photo?: string;
  url?: string;
  distanceKm?: number;
}

/** One way to do the holiday: its hotels, travel and full budget. */
export interface TierPlan {
  style: HolidayStyle;
  hotels: HotelOption[];
  travel: TierTravel | null;
  budget: { lines: BudgetLine[]; total: number; perPerson: number; hotelId: string | null };
}

export interface BudgetLine {
  key: 'travel' | 'hotel' | 'food' | 'local' | 'tickets' | 'buffer';
  label: string;
  amount: number;
  note: string;
}

export interface HolidayPlan {
  destination: Place;
  days: number;
  nights: number;
  travellers: number;
  style: HolidayStyle;
  startDate: string;
  overview: string;
  tips: string[];
  highlights: Sight[];
  itinerary: HolidayDay[];
  hotels: HotelOption[];
  travel: TierTravel | null;
  travelNote?: string;
  budget: { lines: BudgetLine[]; total: number; perPerson: number; hotelId: string | null };
  /** All three tiers side by side; hotels, travel and budget above are tiers[style]. */
  tiers: Record<HolidayStyle, TierPlan>;
}

const STYLES: HolidayStyle[] = ['budget', 'comfort', 'luxury'];

const SIGHTS_PER_DAY = 3;
/** Sights further than this from the destination are dropped. */
const MAX_SIGHT_KM = 30;
/** Per person per day (INR). */
const FOOD: Record<HolidayStyle, number> = { budget: 700, comfort: 1500, luxury: 3500 };
/** Local cabs/autos for the group per day (INR). */
const LOCAL: Record<HolidayStyle, number> = { budget: 600, comfort: 1800, luxury: 4000 };
/** Per room per night (INR) before the city factor. */
const ROOM: Record<HolidayStyle, number> = { budget: 1800, comfort: 4500, luxury: 12000 };
/** Popular or pricey destinations cost more to stay in. */
const PRICEY =
  /goa|mumbai|delhi|bengaluru|bangalore|udaipur|jaipur|shimla|manali|ooty|munnar|darjeeling|rishikesh|leh|ladakh|gangtok|andaman|kochi|mussoorie|nainital/i;

const CATEGORIES: [RegExp, string, number][] = [
  [
    /fort|palace|mahal|museum|observatory|heritage|mausoleum|tomb|haveli|planetarium|aquarium|zoo/i,
    'Heritage & museums',
    200,
  ],
  [/park|garden|lake|sanctuary|national park|waterfall|cave|dam|reservoir|valley/i, 'Nature', 50],
  [/temple|church|mosque|gurdwara|shrine|monastery|basilica|cathedral/i, 'Spiritual', 0],
  [/beach|bay|island|lighthouse/i, 'Beaches & coast', 0],
  [/market|bazaar/i, 'Markets', 0],
];

function toSight(p: WikiPlace): Sight {
  const text = `${p.name} ${p.description}`;
  const [, category, ticket] = CATEGORIES.find(([re]) => re.test(text)) ?? [null, 'Landmark', 0];
  return {
    name: p.name,
    description: p.description,
    summary: p.summary,
    category,
    lat: p.lat,
    lng: p.lng,
    photo: p.photo,
    url: p.url,
    ticket,
  };
}

/** Orders sights so each is near the last, starting from the city centre, then splits into days. */
function buildDays(
  sights: Sight[],
  start: { lat: number; lng: number },
  days: number,
): HolidayDay[] {
  const left = [...sights];
  const route: Sight[] = [];
  let at = start;
  while (left.length) {
    left.sort((a, b) => haversineKm(at, a) - haversineKm(at, b));
    const next = left.shift()!;
    route.push(next);
    at = next;
  }
  const perDay = Math.max(1, Math.ceil(route.length / days));
  return Array.from({ length: days }, (_, i) => {
    const today = route.slice(i * perDay, (i + 1) * perDay);
    let km = 0;
    today.forEach((s, j) => {
      if (j > 0) km += haversineKm(today[j - 1], s);
    });
    const title =
      today.length === 0
        ? 'Free day: shopping, cafés or a day trip'
        : today.length === 1
          ? today[0].name
          : `${today[0].name} & nearby`;
    return { day: i + 1, title, sights: today, distanceKm: Math.round(km * 1.3 * 10) / 10 };
  });
}

/** Small, stable variation per hotel so the options aren't all the same price. */
const vary = (id: string) =>
  0.85 + ([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 30) / 100;

/** Hotels from OpenStreetMap or Wikipedia with estimated prices, for places without TripAdvisor data. */
async function fallbackHotels(
  dest: Place,
  style: HolidayStyle,
  nights: number,
  rooms: number,
  famous: WikiPlace[],
): Promise<HotelOption[]> {
  const factor = PRICEY.test(`${dest.name} ${dest.city}`) ? 1.3 : 1;
  const price = (id: string, s: HolidayStyle) =>
    Math.round((ROOM[s] * factor * vary(id)) / 50) * 50;
  const option = (
    o: Omit<HotelOption, 'nights' | 'rooms' | 'total' | 'pricePerNight' | 'priceSource'>,
    s: HolidayStyle,
  ): HotelOption => {
    const pricePerNight = price(o.id, s);
    return {
      ...o,
      pricePerNight,
      nights,
      rooms,
      total: pricePerNight * nights * rooms,
      priceSource: 'estimate',
    };
  };
  // Luxury: notable hotels from Wikipedia (heritage palaces, landmark hotels) when there are any.
  if (style === 'luxury' && famous.length)
    return [...famous]
      .sort((a, b) => haversineKm(dest, a) - haversineKm(dest, b))
      .slice(0, 3)
      .map((h) =>
        option(
          {
            id: `wiki-${h.pageId}`,
            name: h.name,
            kind: 'hotel',
            stars: 5,
            lat: h.lat,
            lng: h.lng,
            source: 'openstreetmap',
          },
          style,
        ),
      );
  try {
    // Kept short: the public servers are often slow, and estimates are a fine fallback.
    const els = await overpassQuery(
      `hotels|${dest.lat.toFixed(2)},${dest.lng.toFixed(2)}`,
      `nwr["tourism"~"^(hotel|guest_house|hostel|motel)$"]["name"](around:7000,${dest.lat},${dest.lng});`,
      200,
      8_000,
    );
    const hotels = els
      .map((e) => {
        const t = e.tags ?? {};
        const stars = Number(t.stars) || undefined;
        const name = t['name:en'] ?? t.name;
        const fancy =
          /palace|resort|taj|oberoi|marriott|hyatt|itc|leela|radisson|hilton|novotel|courtyard|westin|trident/i.test(
            name,
          );
        const tier: HolidayStyle =
          (stars ?? 0) >= 4 || fancy
            ? 'luxury'
            : t.tourism === 'hostel' || t.tourism === 'guest_house' || (stars ?? 3) <= 2
              ? 'budget'
              : 'comfort';
        return { e, name, stars, tier, kind: t.tourism ?? 'hotel', ...elementPoint(e) };
      })
      .filter((h) => h.name && h.lat);
    const pick = hotels
      .filter((h) => h.tier === style)
      .sort((a, b) => haversineKm(dest, a) - haversineKm(dest, b))
      .slice(0, 3);
    if (pick.length)
      return pick.map((h) =>
        option(
          {
            id: `osm-${h.e.type[0]}${h.e.id}`,
            name: h.name,
            kind: h.kind,
            stars: h.stars,
            lat: h.lat,
            lng: h.lng,
            source: 'openstreetmap',
          },
          style,
        ),
      );
  } catch {
    // fall through to estimates
  }
  const label = { budget: 'Budget guest house', comfort: 'Comfort hotel', luxury: 'Luxury hotel' }[
    style
  ];
  const stars = { budget: 2, comfort: 3, luxury: 5 }[style];
  return ['central', 'old town', 'quiet'].map((area, i) =>
    option(
      {
        id: `est-${style}-${i}`,
        name: `${label}, ${area} ${dest.name}`,
        kind: 'hotel',
        stars,
        lat: dest.lat,
        lng: dest.lng,
        source: 'estimate',
      },
      style,
    ),
  );
}

/** Runs `fn` over items, at most `limit` at a time. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * Three hotels per tier: real TripAdvisor-listed hotels near the destination, priced with live
 * rates for the dates (else their usual price); OpenStreetMap or estimates where there are none.
 */
async function tierHotels(
  dest: Place,
  nights: number,
  rooms: number,
  checkIn: Date,
  famous: WikiPlace[],
): Promise<Record<HolidayStyle, HotelOption[]>> {
  const checkOut = new Date(checkIn.getTime() + nights * 86_400_000);
  const picks = hotelsByTier(dest);
  const listed = STYLES.flatMap((style) => picks[style].map((h) => ({ style, h })));
  const rates = await mapLimit(listed, 4, ({ h }) => liveRate(h.key, checkIn, checkOut));
  const toOption = (h: DataHotel & { km: number }, i: number): HotelOption => {
    const live = rates[i];
    const pricePerNight = live?.rate ?? h.min ?? 0;
    return {
      id: `ta-${h.key}`,
      name: h.name,
      kind: h.type.toLowerCase(),
      lat: h.lat,
      lng: h.lng,
      pricePerNight,
      nights,
      rooms,
      total: pricePerNight * nights * rooms,
      source: 'tripadvisor',
      priceSource: live ? 'live' : 'range',
      provider: live?.provider,
      offers: live?.offers,
      priceMin: h.min ?? undefined,
      priceMax: h.max ?? undefined,
      rating: h.rating ?? undefined,
      reviews: h.reviews,
      photo: h.photo,
      url: h.url,
      distanceKm: Math.round(h.km * 10) / 10,
    };
  };
  const out = {} as Record<HolidayStyle, HotelOption[]>;
  for (const style of STYLES) {
    const real = listed
      .map((x, i) => ({ ...x, i }))
      .filter((x) => x.style === style)
      .map((x) => toOption(x.h, x.i))
      // Live rates can move a hotel's price; cheapest first within the tier.
      .sort((a, b) => a.pricePerNight - b.pricePerNight);
    out[style] = real.length
      ? real
      : await fallbackHotels(dest, style, nights, rooms, famous).catch(() => []);
  }
  return out;
}

/** A short overview and tips written by Gemini from the real sights; plain text if unavailable. */
async function writeOverview(dest: Place, days: number, style: HolidayStyle, sights: Sight[]) {
  const fallback = {
    overview: `${days} days in ${dest.name}, taking in ${sights
      .slice(0, 3)
      .map((s) => s.name)
      .join(
        ', ',
      )}${sights.length > 3 ? ' and more' : ''}. Days are grouped so nearby places are seen together.`,
    tips: [
      'Start early to beat crowds and heat at popular sights.',
      'Carry ID: many monuments ask for it at the ticket counter.',
      'Keep some cash for entry tickets, autos and street food.',
    ],
  };
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || !sights.length) return fallback;
  try {
    const res = await Promise.race([
      postCompletion(
        'Gemini',
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        { Authorization: `Bearer ${key}` },
        {
          model: process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-3.5-flash-lite',
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You write short, friendly holiday overviews for Indian travellers. Use only the places given. Never state prices, timings or facts that are not in the input. Reply as JSON: {"overview": "2 sentences", "tips": ["3 short practical tips"]}.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                destination: `${dest.name}, ${dest.city}`,
                days,
                style,
                places: sights.slice(0, 12).map((s) => ({ name: s.name, about: s.description })),
              }),
            },
          ],
        },
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 9000)),
    ]);
    const parsed = JSON.parse(res.choices[0]?.message.content ?? '{}') as {
      overview?: string;
      tips?: string[];
    };
    return {
      overview: parsed.overview?.trim() || fallback.overview,
      tips:
        Array.isArray(parsed.tips) && parsed.tips.length ? parsed.tips.slice(0, 4) : fallback.tips,
    };
  } catch {
    return fallback;
  }
}

export async function planHoliday(req: HolidayRequest): Promise<HolidayPlan> {
  const days = Math.min(14, Math.max(1, Math.round(req.days)));
  const travellers = Math.min(12, Math.max(1, Math.round(req.travellers)));
  const nights = Math.max(1, days - 1);
  const rooms = Math.ceil(travellers / 2);
  const start = req.startDate ?? new Date(Date.now() + 7 * 86_400_000);

  const dest = await lookupPlace(req.destination);
  if (!dest)
    throw new HttpError(404, `I couldn't find "${req.destination}". Try a city or town name.`);

  // Sights around the centre; longer trips look further out (Wikipedia's search radius is 10 km).
  const d = 0.12;
  const points = [{ lat: dest.lat, lng: dest.lng }];
  if (days >= 3)
    points.push({ lat: dest.lat + d, lng: dest.lng }, { lat: dest.lat - d, lng: dest.lng });
  if (days >= 5)
    points.push({ lat: dest.lat, lng: dest.lng + d }, { lat: dest.lat, lng: dest.lng - d });
  // Sights first (fast); the overview, hotels and travel then run side by side.
  const wikiPromise = sightsNear(points).catch(() => [] as WikiPlace[]);
  // Some articles carry wrong coordinates; anything far from the destination isn't part of it.
  const sightsPromise = wikiPromise.then((w) =>
    w
      .filter((p) => haversineKm(dest, p) <= MAX_SIGHT_KM)
      .slice(0, days * SIGHTS_PER_DAY)
      .map(toSight),
  );
  const [sights, hotels, options, { overview, tips }] = await Promise.all([
    sightsPromise,
    wikiPromise.then(() => tierHotels(dest, nights, rooms, start, notableHotels(points))),
    planForUser({
      from: req.from ?? 'home',
      to: { name: dest.name, lat: dest.lat, lng: dest.lng },
      departAt: start,
    })
      .then((r) => r.options)
      .catch((err: Error) => ({ error: err.message }) as const),
    sightsPromise.then((s) => writeOverview(dest, days, req.style, s)),
  ]);
  const itinerary = buildDays(sights, dest, days);
  const tickets = sights.reduce((s, x) => s + x.ticket, 0) * travellers;

  const routes = 'error' in options ? [] : options;
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const tier = (style: HolidayStyle): TierPlan => {
    // Each style travels its own way (class, cabs, route): see holidayTravel.ts.
    const travel = travelForStyle(routes, style, travellers);
    const hotel = hotels[style][0] ?? null;
    const priceNote = !hotel
      ? ''
      : hotel.priceSource === 'live'
        ? ` (live rate on ${hotel.provider})`
        : hotel.priceSource === 'range'
          ? ' (usual price)'
          : ' (estimate)';
    const lines: BudgetLine[] = [
      {
        key: 'travel',
        label: 'Travel there and back',
        amount: travel?.total ?? 0,
        note: travel
          ? `${style === 'luxury' ? 'Fastest' : 'Cheapest'} route: ${travel.summary}. About ${inr(travel.perPerson)} per person each way${travel.estimated ? ' (upgraded fares estimated)' : ''}`
          : 'Not included (no route from your start point)',
      },
      {
        key: 'hotel',
        label: hotel ? `Hotel: ${hotel.name}` : 'Hotel',
        amount: hotel?.total ?? 0,
        note: hotel
          ? `${nights} night${nights > 1 ? 's' : ''} × ${rooms} room${rooms > 1 ? 's' : ''} at ${inr(hotel.pricePerNight)}/night${priceNote}`
          : 'No hotel found nearby',
      },
      {
        key: 'food',
        label: 'Food',
        amount: FOOD[style] * travellers * days,
        note: `About ${inr(FOOD[style])} per person per day (estimate)`,
      },
      {
        key: 'local',
        label: 'Local travel',
        amount: LOCAL[style] * days,
        note: `Autos and cabs, about ${inr(LOCAL[style])} a day (estimate)`,
      },
      {
        key: 'tickets',
        label: 'Entry tickets',
        amount: tickets,
        note: 'Typical Indian-visitor prices (estimate)',
      },
    ];
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    lines.push({
      key: 'buffer',
      label: 'Buffer (10%)',
      amount: Math.round(subtotal * 0.1),
      note: 'Shopping, tips and surprises',
    });
    const total = lines.reduce((s, l) => s + l.amount, 0);
    return {
      style,
      hotels: hotels[style],
      travel,
      budget: {
        lines,
        total,
        perPerson: Math.round(total / travellers),
        hotelId: hotel?.id ?? null,
      },
    };
  };
  const tiers = Object.fromEntries(STYLES.map((s) => [s, tier(s)])) as Record<
    HolidayStyle,
    TierPlan
  >;
  const chosen = tiers[req.style];

  return {
    destination: dest,
    days,
    nights,
    travellers,
    style: req.style,
    startDate: start.toISOString(),
    overview,
    tips,
    highlights: sights.slice(0, 6),
    itinerary,
    hotels: chosen.hotels,
    travel: chosen.travel,
    travelNote: 'error' in options ? options.error : undefined,
    budget: chosen.budget,
    tiers,
  };
}
