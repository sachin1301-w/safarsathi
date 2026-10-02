/**
 * Multimodal journey planner.
 *
 * Builds candidate chains — city-only multimodal (walk/auto/bike taxi/cab/metro/bus),
 * city leg → intercity service → city leg, or EV drive with charger stops — schedules
 * them in IST, then picks the Fastest, Cheapest and Greenest options.
 */
import type {
  BusSystem,
  ChargerAdapter,
  GeocodeAdapter,
  IntercityService,
  MetroLine,
  MetroSystem,
  ScheduleAdapter,
  Station,
  TransitAdapter,
} from '../adapters/types';
import { haversineKm, projectOnSegment, roadKm, type LatLng } from '../lib/geo';
import { addMins, atIst, diffMins, isPeak } from '../lib/time';
import type { Itinerary, Leg, Mode, OptionLabel, Place, Point } from '../types';
import { co2SavedKg, legCo2Kg } from './greenScore';

// ------------------------------------------------------------------ inputs

export interface EvProfile {
  rangeKm: number; // full battery
  batteryPct: number; // current charge
  connector?: string;
}

export interface PlanRequest {
  from: string | Point;
  to: string | Point;
  arriveBy?: Date;
  departAt?: Date;
  preference?: OptionLabel;
  /** true: plan with the user's EV only. false: never. undefined: include EV if the user has one. */
  useEv?: boolean;
  ev?: EvProfile | null;
  /** Names like "home" / "office" mapped to place ids. */
  savedPlaces?: Record<string, string>;
  now?: Date;
}

export interface PlannerDeps {
  geocode: GeocodeAdapter;
  transit: TransitAdapter;
  schedules: ScheduleAdapter;
  chargers: ChargerAdapter;
}

export interface PlanResult {
  from: Place;
  to: Place;
  options: Itinerary[];
}

export class PlanError extends Error {}

// --------------------------------------------------------------- constants

/** City speeds in km/h (spec). Road modes halve in peak hours. Bike taxi assumed like a cab. */
const SPEED_KMH: Partial<Record<Mode, number>> = {
  WALK: 5,
  BUS: 18,
  AUTO: 22,
  BIKE_TAXI: 25,
  CAB: 25,
  EV_DRIVE: 25,
};
const HIGHWAY_KMH = 50; // cars outside the city
const HIGHWAY_THRESHOLD_KM = 40;
const PICKUP_WAIT_MINS: Partial<Record<Mode, number>> = { AUTO: 4, BIKE_TAXI: 4, CAB: 6 };

/** Minimum time at the hub before a scheduled service leaves (spec: train 20, flight 60). */
const BOARDING_BUFFER_MINS = { FLIGHT: 60, TRAIN: 20, INTERCITY_BUS: 15 } as const;
/** Time to get out after arrival (deplaning, platform exit). */
const EXIT_MINS = { FLIGHT: 15, TRAIN: 5, INTERCITY_BUS: 5 } as const;

const METRO_SEARCH_KM = 4; // Ramwadi metro is ~3.3 km from Pune Airport
const METRO_WALK_KM = 0.8;
const BUS_STOP_WALK_KM = 1;
const TRIVIAL_KM = 0.15; // closer than this, no separate walk leg
const METRO_TRANSFER_MINS = 5;

// EV model: ~0.15 kWh/km, charge to 80%, keep 10% of full range in reserve.
const EV_KWH_PER_KM = 0.15;
const EV_HOME_COST_PER_KM = 1.2; // ₹8/kWh home tariff
const EV_CHARGE_TO = 0.8;
const EV_RESERVE = 0.1;
const EV_MAX_CAR_KW = 60;
const EV_CORRIDOR_KM = 15;
const EV_BUSY_WAIT_MINS = 20;
const EV_MAX_STOPS = 4;

// ------------------------------------------------------------------- types

/** An unscheduled leg: everything but times. */
interface Segment {
  mode: Mode;
  from: Point;
  to: Point;
  durationMins: number;
  cost: number;
  distanceKm: number;
  provider?: string;
  serviceNo?: string;
  notes?: string;
  chargerStopId?: string;
  /** Idle time after this segment before the next one starts (e.g. charging). */
  waitAfterMins?: number;
}

interface Candidate {
  legs: Leg[];
  depart: Date;
  arrive: Date;
  totalMins: number;
  totalCost: number;
  co2Kg: number;
  onTime: boolean;
}

// ----------------------------------------------------------------- helpers

const point = (p: { name: string; lat: number; lng: number }): Point => ({
  name: p.name,
  lat: p.lat,
  lng: p.lng,
});
const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

function speedKmh(mode: Mode, at: Date, highway: boolean): number {
  if ((mode === 'CAB' || mode === 'EV_DRIVE') && highway) return HIGHWAY_KMH;
  const base = SPEED_KMH[mode] ?? 25;
  const roadMode = mode !== 'WALK';
  return roadMode && isPeak(at) ? base / 2 : base;
}

function fare(mode: Mode, km: number): number {
  switch (mode) {
    case 'AUTO':
      return 26 + Math.max(0, km - 1.5) * 17; // Pune RTO style: ₹26 for the first 1.5 km
    case 'BIKE_TAXI':
      return 20 + km * 7;
    case 'CAB':
      return km > HIGHWAY_THRESHOLD_KM ? 300 + km * 13 : 60 + km * 18;
    case 'EV_DRIVE':
      return km * EV_HOME_COST_PER_KM;
    default:
      return 0;
  }
}

/** A door-to-door road or walking segment. */
function directSegment(mode: Mode, a: Point, b: Point, at: Date, highway?: boolean): Segment {
  const km = roadKm(a, b);
  const onHighway = highway ?? km > HIGHWAY_THRESHOLD_KM;
  const mins = (km / speedKmh(mode, at, onHighway)) * 60 + (PICKUP_WAIT_MINS[mode] ?? 0);
  const provider =
    mode === 'AUTO'
      ? 'Auto-rickshaw'
      : mode === 'BIKE_TAXI'
        ? 'Bike taxi'
        : mode === 'CAB'
          ? 'Cab'
          : undefined;
  return {
    mode,
    from: a,
    to: b,
    durationMins: Math.max(1, Math.ceil(mins)),
    cost: Math.round(fare(mode, km)),
    distanceKm: round1(km),
    provider,
  };
}

/** Getting to or from a station: walk if close, else an auto. */
function mile(a: Point, b: Point, at: Date): Segment | null {
  const km = haversineKm(a, b);
  if (km < TRIVIAL_KM) return null;
  return directSegment(km <= METRO_WALK_KM ? 'WALK' : 'AUTO', a, b, at);
}

const chainMins = (segs: Segment[]) => sum(segs, (s) => s.durationMins + (s.waitAfterMins ?? 0));
const chainCost = (segs: Segment[]) => sum(segs, (s) => s.cost);
const chainCo2 = (segs: Segment[]) => sum(segs, legCo2Kg);

// ------------------------------------------------------------------- metro

interface Ride {
  line: MetroLine;
  from: Station;
  to: Station;
  km: number;
  mins: number;
  stops: number;
}

const metroGraphs = new WeakMap<MetroSystem, Map<string, { line: MetroLine; idx: number }[]>>();

function stationIndex(sys: MetroSystem) {
  let idx = metroGraphs.get(sys);
  if (!idx) {
    idx = new Map();
    for (const line of sys.lines) {
      line.stations.forEach((s, i) => {
        const list = idx!.get(s.id) ?? [];
        list.push({ line, idx: i });
        idx!.set(s.id, list);
      });
    }
    metroGraphs.set(sys, idx);
  }
  return idx;
}

/** Shortest metro path (in minutes) between two stations, allowing line changes. */
function metroPath(sys: MetroSystem, fromId: string, toId: string): Ride[] | null {
  const index = stationIndex(sys);
  type State = { station: string; line: string };
  const key = (s: State) => `${s.station}|${s.line}`;
  const dist = new Map<string, number>();
  const prev = new Map<string, State | null>();
  const queue: { state: State; d: number }[] = [];

  for (const { line } of index.get(fromId) ?? []) {
    const s = { station: fromId, line: line.id };
    dist.set(key(s), 0);
    prev.set(key(s), null);
    queue.push({ state: s, d: 0 });
  }

  let goal: State | null = null;
  while (queue.length) {
    queue.sort((a, b) => a.d - b.d);
    const { state, d } = queue.shift()!;
    if (d > (dist.get(key(state)) ?? Infinity)) continue;
    if (state.station === toId) {
      goal = state;
      break;
    }
    const visit = (next: State, cost: number) => {
      const nd = d + cost;
      if (nd < (dist.get(key(next)) ?? Infinity)) {
        dist.set(key(next), nd);
        prev.set(key(next), state);
        queue.push({ state: next, d: nd });
      }
    };
    for (const { line, idx } of index.get(state.station) ?? []) {
      if (line.id === state.line) {
        for (const j of [idx - 1, idx + 1]) {
          const nb = line.stations[j];
          if (!nb) continue;
          const km = haversineKm(line.stations[idx], nb);
          visit({ station: nb.id, line: line.id }, (km / sys.speedKmh) * 60 + 0.5);
        }
      } else {
        visit({ station: state.station, line: line.id }, METRO_TRANSFER_MINS);
      }
    }
  }
  if (!goal) return null;

  // Walk back to a list of states, then group consecutive states on the same line into rides.
  const states: State[] = [];
  for (let s: State | null = goal; s; s = prev.get(key(s)) ?? null) states.unshift(s);
  const rides: Ride[] = [];
  for (let i = 0; i < states.length;) {
    let j = i;
    while (j + 1 < states.length && states[j + 1].line === states[i].line) j++;
    if (j > i) {
      const line = sys.lines.find((l) => l.id === states[i].line)!;
      const from = line.stations.find((s) => s.id === states[i].station)!;
      const to = line.stations.find((s) => s.id === states[j].station)!;
      const a = line.stations.indexOf(from);
      const b = line.stations.indexOf(to);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      let km = 0;
      for (let k = lo; k < hi; k++) km += haversineKm(line.stations[k], line.stations[k + 1]);
      rides.push({
        line,
        from,
        to,
        km,
        mins: (km / sys.speedKmh) * 60 + (hi - lo) * 0.5,
        stops: hi - lo,
      });
    }
    i = j + 1;
  }
  return rides.length ? rides : null;
}

function metroFare(sys: MetroSystem, km: number): number {
  return (sys.fareSlabs.find(([maxKm]) => km <= maxKm) ?? sys.fareSlabs.at(-1)!)[1];
}

function nearestStations(sys: MetroSystem, p: LatLng, n = 2): Station[] {
  const seen = new Map<string, Station>();
  for (const line of sys.lines) for (const s of line.stations) seen.set(s.id, s);
  return [...seen.values()]
    .map((s) => ({ s, km: haversineKm(p, s) }))
    .filter((x) => x.km <= METRO_SEARCH_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
    .map((x) => x.s);
}

function metroChain(sys: MetroSystem, a: Point, b: Point, at: Date): Segment[] | null {
  let best: Segment[] | null = null;
  for (const sa of nearestStations(sys, a)) {
    for (const sb of nearestStations(sys, b)) {
      if (sa.id === sb.id) continue;
      const rides = metroPath(sys, sa.id, sb.id);
      if (!rides) continue;
      const totalKm = sum(rides, (r) => r.km);
      if (totalKm < 1.5) continue;
      const segs: Segment[] = [];
      const access = mile(a, point(sa), at);
      if (access) segs.push(access);
      rides.forEach((r, i) => {
        const wait = i === 0 ? sys.headwayMins / 2 : METRO_TRANSFER_MINS;
        segs.push({
          mode: 'METRO',
          from: point(r.from),
          to: point(r.to),
          durationMins: Math.ceil(r.mins + wait),
          cost: i === 0 ? metroFare(sys, totalKm) : 0,
          distanceKm: round1(r.km),
          provider: sys.provider,
          serviceNo: r.line.name,
          notes: `${r.stops} stop${r.stops === 1 ? '' : 's'}`,
        });
      });
      const egress = mile(point(sb), b, at);
      if (egress) segs.push(egress);
      if (!best || chainMins(segs) < chainMins(best)) best = segs;
    }
  }
  return best;
}

// --------------------------------------------------------------------- bus

function busChain(sys: BusSystem, a: Point, b: Point, at: Date): Segment[] | null {
  let best: Segment[] | null = null;
  for (const route of sys.routes) {
    let pick: { i: number; j: number; walk: number } | null = null;
    route.stops.forEach((sa, i) => {
      const wa = haversineKm(a, sa);
      if (wa > BUS_STOP_WALK_KM) return;
      route.stops.forEach((sb, j) => {
        const wb = haversineKm(sb, b);
        if (i === j || wb > BUS_STOP_WALK_KM) return;
        if (!pick || wa + wb < pick.walk) pick = { i, j, walk: wa + wb };
      });
    });
    if (!pick) continue;
    const { i, j } = pick as { i: number; j: number };
    const [lo, hi] = i < j ? [i, j] : [j, i];
    let km = 0;
    for (let k = lo; k < hi; k++) km += haversineKm(route.stops[k], route.stops[k + 1]) * 1.2;
    const speed = isPeak(at) ? sys.speedKmh / 2 : sys.speedKmh;
    const segs: Segment[] = [];
    const access = mile(a, point(route.stops[i]), at);
    if (access) segs.push({ ...access, mode: 'WALK', cost: 0, provider: undefined });
    segs.push({
      mode: 'BUS',
      from: point(route.stops[i]),
      to: point(route.stops[j]),
      durationMins: Math.ceil((km / speed) * 60 + route.frequencyMins / 2),
      cost: Math.round(Math.min(sys.maxFare, Math.max(sys.minFare, km * sys.farePerKm))),
      distanceKm: round1(km),
      provider: sys.provider,
      serviceNo: `Route ${route.id}`,
      notes: route.name,
    });
    const egress = mile(point(route.stops[j]), b, at);
    if (egress) segs.push({ ...egress, mode: 'WALK', cost: 0, provider: undefined });
    // Re-time the walks (mile() may have priced an auto).
    for (const s of segs)
      if (s.mode === 'WALK') s.durationMins = Math.ceil((s.distanceKm / 5) * 60);
    if (!best || chainMins(segs) < chainMins(best)) best = segs;
  }
  return best;
}

// -------------------------------------------------------------------- city

/** All sensible ways to get from a to b within one city. */
function cityChains(
  deps: PlannerDeps,
  a: Point,
  b: Point,
  city: string,
  at: Date,
  opts: { luggage?: boolean } = {},
): Segment[][] {
  const km = haversineKm(a, b);
  if (km < TRIVIAL_KM) return [[]];
  const road = roadKm(a, b);
  const chains: Segment[][] = [];
  if (km <= 2.5) chains.push([directSegment('WALK', a, b, at)]);
  if (road <= 30) chains.push([directSegment('AUTO', a, b, at)]);
  // Nobody takes a bike taxi to the airport with a suitcase.
  if (road <= 25 && !opts.luggage) chains.push([directSegment('BIKE_TAXI', a, b, at)]);
  chains.push([directSegment('CAB', a, b, at)]);
  const sys = deps.transit.forCity(city);
  if (sys?.metro) {
    const m = metroChain(sys.metro, a, b, at);
    if (m) chains.push(m);
  }
  if (sys?.bus) {
    const bus = busChain(sys.bus, a, b, at);
    if (bus) chains.push(bus);
  }
  return chains;
}

/** The fastest, cheapest and greenest of a set of chains (deduplicated). */
function variants(chains: Segment[][]): Segment[][] {
  if (chains.length <= 1) return chains;
  const by = (f: (c: Segment[]) => number) => [...chains].sort((x, y) => f(x) - f(y))[0];
  return [...new Set([by(chainMins), by(chainCost), by(chainCo2)])];
}

// ---------------------------------------------------------------------- EV

async function evChains(
  deps: PlannerDeps,
  a: Point,
  b: Point,
  ev: EvProfile,
  at: Date,
): Promise<Segment[][]> {
  const full = ev.rangeKm;
  const available = (full * ev.batteryPct) / 100;
  const reserve = full * EV_RESERVE;
  const tripKm = roadKm(a, b);
  const highway = tripKm > HIGHWAY_THRESHOLD_KM;
  const drive = (from: Point, to: Point): Segment => ({
    ...directSegment('EV_DRIVE', from, to, at, highway),
    provider: 'Your EV',
  });

  if (tripKm <= 0.8 * available) return [[drive(a, b)]];

  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const nearby = await deps.chargers.findNear({
    lat: mid.lat,
    lng: mid.lng,
    radiusKm: haversineKm(a, b) / 2 + 25,
    connector: ev.connector,
  });
  const corridor = nearby
    .filter((c) => c.status === 'WORKING' || c.status === 'BUSY')
    .map((c) => ({ c, ...projectOnSegment(a, b, c) }))
    .filter((x) => x.offKm <= EV_CORRIDOR_KM && x.along > 0.05 && x.along < 0.98);

  const plan = (strategy: 'fast' | 'cheap'): Segment[] | null => {
    const segs: Segment[] = [];
    let pos: Point = a;
    let along = 0;
    let range = available;
    for (let stops = 0; roadKm(pos, b) > range - reserve; stops++) {
      if (stops >= EV_MAX_STOPS) return null;
      const reachable = corridor.filter(
        (x) => x.along > along && roadKm(pos, x.c) <= range - reserve,
      );
      if (!reachable.length) return null;
      const score = (x: (typeof reachable)[number]) =>
        (x.c.status === 'WORKING' ? 0 : 1000) +
        (strategy === 'fast' ? -x.along * 100 - x.c.powerKw / 10 : x.c.pricePerKwh - x.along);
      const { c } = [...reachable].sort((x, y) => score(x) - score(y))[0];
      const leg = drive(pos, point(c));
      range -= leg.distanceKm;
      const addKm = Math.max(0, full * EV_CHARGE_TO - range);
      const kwh = addKm * EV_KWH_PER_KM;
      const chargeMins =
        Math.ceil((kwh / Math.min(c.powerKw, EV_MAX_CAR_KW)) * 60 * 1.1) +
        5 +
        (c.status === 'BUSY' ? EV_BUSY_WAIT_MINS : 0);
      const chargeCost = Math.round(kwh * c.pricePerKwh);
      segs.push({
        ...leg,
        to: point(c),
        cost: leg.cost + chargeCost,
        chargerStopId: c.id,
        waitAfterMins: chargeMins,
        notes: `Charge ${chargeMins} min to ${Math.round(EV_CHARGE_TO * 100)}% at ${c.powerKw} kW (₹${chargeCost})${
          c.status === 'BUSY' ? ', may have a short queue' : ''
        }`,
      });
      range = full * EV_CHARGE_TO;
      pos = point(c);
      along = projectOnSegment(a, b, c).along;
    }
    segs.push(drive(pos, b));
    return segs;
  };

  const fast = plan('fast');
  const cheap = plan('cheap');
  const stopsKey = (s: Segment[] | null) => s?.map((x) => x.chargerStopId).join(',');
  return [fast, stopsKey(cheap) === stopsKey(fast) ? null : cheap].filter(
    (s): s is Segment[] => !!s,
  );
}

// -------------------------------------------------------------- scheduling

let legSeq = 0;

function scheduleForward(segs: Segment[], start: Date): Leg[] {
  let t = start;
  return segs.map((s) => {
    const departAt = t;
    const arriveAt = addMins(departAt, s.durationMins);
    t = addMins(arriveAt, s.waitAfterMins ?? 0);
    const leg: Leg = {
      ...s,
      id: `leg-${++legSeq}`,
      departAt: departAt.toISOString(),
      arriveAt: arriveAt.toISOString(),
      status: 'ON_TIME',
    };
    delete (leg as Partial<Segment>).waitAfterMins;
    return leg;
  });
}

function toCandidate(legs: Leg[], arriveBy?: Date): Candidate {
  const depart = new Date(legs[0].departAt);
  const arrive = new Date(legs.at(-1)!.arriveAt);
  return {
    legs,
    depart,
    arrive,
    totalMins: diffMins(arrive, depart),
    totalCost: Math.round(sum(legs, (l) => l.cost)),
    co2Kg: sum(legs, legCo2Kg),
    onTime: !arriveBy || arrive <= arriveBy,
  };
}

/** Schedules a chain to arrive just before `arriveBy`, or to leave at `earliest`. */
function scheduleChain(segs: Segment[], earliest: Date, arriveBy?: Date): Leg[] {
  if (arriveBy) {
    const start = addMins(arriveBy, -chainMins(segs) - 5);
    if (start >= earliest) return scheduleForward(segs, start);
  }
  return scheduleForward(segs, earliest);
}

// --------------------------------------------------------------- intercity

function intercityCandidates(
  deps: PlannerDeps,
  from: Place,
  to: Place,
  earliest: Date,
  arriveBy: Date | undefined,
): Candidate[] {
  const anchor = arriveBy ?? earliest;
  const services = deps.schedules.services().filter((s) => {
    const a = deps.geocode.byId(s.fromPlaceId);
    const b = deps.geocode.byId(s.toPlaceId);
    return a?.city === from.city && b?.city === to.city;
  });

  // City legs depend on peak hours, so cache them per hub and peak/off-peak.
  const cache = new Map<string, Segment[][]>();
  const cityLegs = (a: Point, b: Point, city: string, at: Date) => {
    const k = `${a.lat},${a.lng}>${b.lat},${b.lng}:${isPeak(at)}`;
    if (!cache.has(k)) cache.set(k, variants(cityChains(deps, a, b, city, at, { luggage: true })));
    return cache.get(k)!;
  };

  const out: Candidate[] = [];
  for (const svc of services) {
    const hubA = point(deps.geocode.byId(svc.fromPlaceId)!);
    const hubB = point(deps.geocode.byId(svc.toPlaceId)!);
    for (const dayOffset of [-1, 0, 1]) {
      for (const hhmm of svc.departures) {
        const dep = atIst(anchor, hhmm, dayOffset);
        const arr = addMins(dep, svc.durationMins);
        const atHub = addMins(dep, -BOARDING_BUFFER_MINS[svc.mode]);
        const out1 = addMins(arr, EXIT_MINS[svc.mode]);
        for (const access of cityLegs(point(from), hubA, from.city, addMins(atHub, -45))) {
          const start = addMins(atHub, -chainMins(access));
          if (start < addMins(earliest, -1)) continue;
          for (const egress of cityLegs(hubB, point(to), to.city, out1)) {
            const legs = [
              ...scheduleForward(access, start),
              serviceLeg(svc, hubA, hubB, dep),
              ...scheduleForward(egress, out1),
            ];
            out.push(toCandidate(legs, arriveBy));
          }
        }
      }
    }
  }
  return out;
}

function serviceLeg(svc: IntercityService, a: Point, b: Point, dep: Date): Leg {
  const km = svc.mode === 'FLIGHT' ? haversineKm(a, b) : roadKm(a, b);
  return {
    id: `leg-${++legSeq}`,
    mode: svc.mode,
    from: a,
    to: b,
    departAt: dep.toISOString(),
    arriveAt: addMins(dep, svc.durationMins).toISOString(),
    durationMins: svc.durationMins,
    cost: svc.fare,
    distanceKm: round1(km),
    provider: svc.provider,
    serviceNo: svc.serviceNo,
    notes: svc.fareClass ? `${svc.name} · ${svc.fareClass}` : svc.name,
    status: 'ON_TIME',
  };
}

// ---------------------------------------------------------------- selection

const LABELS: OptionLabel[] = ['FASTEST', 'CHEAPEST', 'GREENEST'];
const MAX_OPTIONS = 3;

/** Same modes and services = same option, even at a different time. */
const signature = (c: Candidate) => c.legs.map((l) => `${l.mode}:${l.serviceNo ?? ''}`).join('>');

interface Picked {
  c: Candidate;
  label: OptionLabel;
  badges: OptionLabel[];
}

/**
 * The best candidate per label. A route that wins several metrics is shown once with all its
 * badges, and the remaining slots are filled with distinct runner-ups (shown with no badge),
 * so a label is never put on an option that doesn't actually win it.
 */
function pickOptions(cands: Candidate[], arriveBy: Date | undefined): Picked[] {
  let pool = cands;
  let deadline = arriveBy;
  if (arriveBy) {
    const onTime = cands.filter((c) => c.onTime);
    // Don't suggest arriving the morning before a dinner meeting when a same-day option exists.
    const sensible = onTime.filter((c) => diffMins(arriveBy, c.arrive) <= 8 * 60);
    pool = sensible.length ? sensible : onTime.length ? onTime : cands;
    // If nothing makes it in time, the best we can do is arrive as early as possible.
    if (!onTime.length) deadline = undefined;
  }
  const scorers: Record<OptionLabel, (c: Candidate) => number[]> = {
    // With a deadline, fastest = shortest door to door; without one, the earliest arrival.
    FASTEST: (c) => [deadline ? c.totalMins : c.arrive.getTime(), c.totalCost],
    CHEAPEST: (c) => [c.totalCost, c.totalMins],
    GREENEST: (c) => [Math.round(c.co2Kg * 10), c.totalCost],
  };
  const cmp = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1];
  const rank = (label: OptionLabel, xs: Candidate[]) =>
    [...xs].sort((a, b) => cmp(scorers[label](a), scorers[label](b)));

  const picked: Picked[] = [];
  for (const label of LABELS) {
    const best = rank(label, pool)[0];
    const existing = picked.find((p) => p.c === best);
    if (existing) existing.badges.push(label);
    else picked.push({ c: best, label, badges: [label] });
  }
  const seen = new Set(picked.map((p) => signature(p.c)));
  for (const c of rank('FASTEST', pool)) {
    if (picked.length >= MAX_OPTIONS) break;
    if (seen.has(signature(c))) continue;
    seen.add(signature(c));
    picked.push({ c, label: 'FASTEST', badges: [] });
  }
  return picked;
}

// --------------------------------------------------------------------- api

function resolvePlace(
  deps: PlannerDeps,
  input: string | Point,
  saved?: Record<string, string>,
): Place {
  if (typeof input !== 'string') {
    const nearest = [...deps.geocode.all()].sort(
      (x, y) => haversineKm(input, x) - haversineKm(input, y),
    )[0];
    const city = nearest && haversineKm(input, nearest) < 40 ? nearest.city : 'Unknown';
    return {
      id: 'custom',
      name: input.name,
      city,
      lat: input.lat,
      lng: input.lng,
      type: 'AREA',
      aliases: [],
    };
  }
  const savedId = saved?.[input.trim().toLowerCase()];
  const place = (savedId && deps.geocode.byId(savedId)) || deps.geocode.resolve(input);
  if (!place)
    throw new PlanError(`I couldn't find "${input}". Try a nearby landmark or area name.`);
  return place;
}

export async function planJourney(req: PlanRequest, deps: PlannerDeps): Promise<PlanResult> {
  const now = req.now ?? new Date();
  const from = resolvePlace(deps, req.from, req.savedPlaces);
  const to = resolvePlace(deps, req.to, req.savedPlaces);
  if (haversineKm(from, to) < 0.2) throw new PlanError('Start and destination are the same place.');

  const earliest = req.departAt && req.departAt > now ? req.departAt : now;
  const arriveBy = req.arriveBy;
  const at = arriveBy ? addMins(arriveBy, -60) : earliest;
  const sameCity = from.city === to.city;
  const road = roadKm(from, to);

  let candidates: Candidate[];
  if (sameCity) {
    candidates = cityChains(deps, point(from), point(to), from.city, at)
      .filter((c) => c.length)
      .map((segs) => toCandidate(scheduleChain(segs, earliest, arriveBy), arriveBy));
  } else {
    candidates = intercityCandidates(deps, from, to, earliest, arriveBy);
    if (road <= 400) {
      const cab = directSegment('CAB', point(from), point(to), at);
      candidates.push(
        toCandidate(
          scheduleChain([{ ...cab, provider: 'Outstation cab' }], earliest, arriveBy),
          arriveBy,
        ),
      );
    }
  }

  if (req.useEv !== false && req.ev) {
    const evOptions = (await evChains(deps, point(from), point(to), req.ev, at)).map((segs) =>
      toCandidate(scheduleChain(segs, earliest, arriveBy), arriveBy),
    );
    // "Plan an EV trip" means EV options only, when there is one.
    if (req.useEv === true && evOptions.length) candidates = evOptions;
    else candidates.push(...evOptions);
  }

  if (!candidates.length) {
    throw new PlanError(`No routes found from ${from.name} to ${to.name} in the demo data.`);
  }

  const picked = pickOptions(candidates, arriveBy);
  const options: Itinerary[] = picked.map(({ label, badges, c }) => ({
    label,
    badges,
    title: `${from.name} → ${to.name}`,
    legs: c.legs,
    totalMins: c.totalMins,
    totalCost: c.totalCost,
    co2SavedKg: co2SavedKg(c.legs, from, to),
    arriveBy: arriveBy?.toISOString(),
    onTime: c.onTime,
  }));
  if (req.preference) {
    const pref = req.preference;
    options.sort((x, y) => Number(y.badges.includes(pref)) - Number(x.badges.includes(pref)));
  }
  return { from, to, options };
}
