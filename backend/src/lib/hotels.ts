/**
 * Real hotels for the holiday planner. data/hotels.india.json (scripts/fetch-hotels-india.ts)
 * holds the top TripAdvisor-listed hotels for India's tourist destinations with their usual
 * nightly price range; Xotelo then gives live rates (Booking.com, Agoda, …) for the exact dates.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Place } from '../types';
import { haversineKm } from './geo';

export type Tier = 'budget' | 'comfort' | 'luxury';

export interface DataHotel {
  key: string;
  name: string;
  type: string;
  rating: number | null;
  reviews: number;
  /** Usual nightly price range for a double room, INR (converted from USD). */
  min: number | null;
  max: number | null;
  lat: number;
  lng: number;
  photo?: string;
  url: string;
  city: string;
}

export interface LiveRate {
  /** Cheapest nightly rate across booking sites, INR. */
  rate: number;
  provider: string;
  offers: { name: string; rate: number }[];
}

/** INR per USD for the dataset's price ranges (live rates already come in INR). */
const USD_INR = Number(process.env.USD_INR) || 88;
/** Nightly price (INR, lower end of the usual range) that separates the tiers. */
const TIER_LIMITS = { comfort: 3000, luxury: 8000 };

let cache: DataHotel[] | null = null;
/** Tourist destinations in the hotel list, each placed at the middle of its hotels. */
let towns: { name: string; area: string; lat: number; lng: number; hotels: number }[] = [];

function load(): DataHotel[] {
  if (cache) return cache;
  const file = join(import.meta.dirname, '..', '..', 'data', 'hotels.india.json');
  if (!existsSync(file)) return (cache = []);
  const raw = JSON.parse(readFileSync(file, 'utf8')) as {
    imageBase?: string;
    cities: { geo: string; name: string }[];
    hotels: {
      k: string;
      n: string;
      t: string;
      r: number | null;
      c: number;
      lo: number | null;
      hi: number | null;
      lat: number;
      lng: number;
      img: string | null;
      u: string;
      g: string;
    }[];
  };
  const city = new Map(raw.cities.map((c) => [c.geo, c.name]));
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  towns = raw.cities.flatMap((c) => {
    const own = raw.hotels.filter((h) => h.g === c.geo);
    if (!own.length) return [];
    return [
      {
        name: c.name,
        area: (c as { area?: string }).area ?? c.name,
        lat: median(own.map((h) => h.lat)),
        lng: median(own.map((h) => h.lng)),
        hotels: own.length,
      },
    ];
  });
  const inr = (usd: number | null) => (usd ? Math.round((usd * USD_INR) / 50) * 50 : null);
  // A hotel can be listed under two localities (different "g", same "d" number); keep one.
  const seen = new Set<string>();
  const unique = raw.hotels.filter((h) => {
    const id = h.k.split('-').pop()!;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  cache = unique.map((h) => ({
    key: h.k,
    name: h.n,
    type: h.t,
    rating: h.r,
    reviews: h.c,
    min: inr(h.lo),
    max: inr(h.hi),
    lat: h.lat,
    lng: h.lng,
    photo: h.img
      ? h.img.startsWith('http')
        ? h.img
        : `${raw.imageBase ?? ''}${h.img}`
      : undefined,
    url: `https://www.tripadvisor.com/Hotel_Review-${h.u}`,
    city: city.get(h.g) ?? '',
  }));
  return cache;
}

export const hotelCount = () => load().length;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/,?\s*india$/, '')
    .replace(/[^a-z]+/g, ' ')
    .trim();

/**
 * A tourist destination from the hotel list by name ("Udaipur", "udaipur, rajasthan"), so the
 * holiday planner still finds well-known places when the online place search is down.
 */
export function touristPlace(query: string): Place | null {
  load();
  const q = norm(query);
  if (q.length < 3) return null;
  const hit = towns
    .filter((t) => {
      const n = norm(t.name);
      return q === n || q.startsWith(`${n} `) || norm(t.area).startsWith(q);
    })
    .sort((a, b) => b.hotels - a.hotels)[0];
  if (!hit) return null;
  return {
    id: `town-${norm(hit.name).replace(/ /g, '-')}`,
    name: hit.name,
    city: hit.name,
    lat: hit.lat,
    lng: hit.lng,
    type: 'AREA',
    aliases: [],
  };
}

export function tierOf(h: DataHotel): Tier | null {
  if (!h.min) return null;
  return h.min >= TIER_LIMITS.luxury
    ? 'luxury'
    : h.min >= TIER_LIMITS.comfort
      ? 'comfort'
      : 'budget';
}

/**
 * The best-reviewed hotels of each tier near a point: 15 km first, up to 40 km if that town has
 * few (beyond that they'd be in another town; the planner falls back to OpenStreetMap).
 * Within a tier, well-rated places with many reviews and close to the centre come first.
 */
export function hotelsByTier(at: { lat: number; lng: number }, perTier = 3) {
  const all = load();
  let near: (DataHotel & { km: number })[] = [];
  for (const radius of [15, 25, 40]) {
    near = all
      .map((h) => ({ ...h, km: haversineKm(at, h) }))
      // Only places with a real rating are recommended.
      .filter((h) => h.km <= radius && h.min && h.rating);
    if (near.length >= 12) break;
  }
  const score = (h: DataHotel & { km: number }) =>
    (h.rating ?? 0) * Math.log10(h.reviews + 10) - h.km * 0.04;
  const out: Record<Tier, (DataHotel & { km: number })[]> = { budget: [], comfort: [], luxury: [] };
  // Well-reviewed places (3.5+, at least 10 reviews) first; others only to fill a tier.
  const trusted = (h: DataHotel) => (h.rating ?? 0) >= 3.5 && h.reviews >= 10;
  for (const tier of ['budget', 'comfort', 'luxury'] as const)
    out[tier] = near
      .filter((h) => tierOf(h) === tier)
      .sort((a, b) => Number(trusted(b)) - Number(trusted(a)) || score(b) - score(a))
      .slice(0, perTier);
  return out;
}

/* ---------- Live rates ---------- */

const RATES_API = 'https://data.xotelo.com/api/rates';
const rateCache = new Map<string, { at: number; value: LiveRate | null }>();
const RATE_TTL_MS = 6 * 60 * 60 * 1000;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Live nightly rates for one hotel and dates; null if no site has it or the API is down. */
export async function liveRate(key: string, checkIn: Date, checkOut: Date) {
  const id = `${key}|${ymd(checkIn)}|${ymd(checkOut)}`;
  const hit = rateCache.get(id);
  if (hit && Date.now() - hit.at < RATE_TTL_MS) return hit.value;
  let value: LiveRate | null = null;
  try {
    const url = `${RATES_API}?hotel_key=${key}&chk_in=${ymd(checkIn)}&chk_out=${ymd(checkOut)}&currency=INR`;
    const res = await fetch(url, { signal: AbortSignal.timeout(9_000) });
    const json = (await res.json()) as {
      result?: { rates?: { name: string; rate: number; tax: number | null }[] } | null;
    };
    const offers = (json.result?.rates ?? [])
      .filter((r) => r.rate > 0)
      .map((r) => ({ name: r.name, rate: Math.round(r.rate + (r.tax ?? 0)) }))
      .sort((a, b) => a.rate - b.rate);
    if (offers.length)
      value = { rate: offers[0].rate, provider: offers[0].name, offers: offers.slice(0, 3) };
  } catch {
    // no live rate; the caller falls back to the usual price range
  }
  rateCache.set(id, { at: Date.now(), value });
  return value;
}
