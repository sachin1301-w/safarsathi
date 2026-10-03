/**
 * Travel there and back for each holiday style. The journey planner gives the routes (cheapest,
 * fastest, …); each style then travels its own way:
 *   budget  – the cheapest route: sleeper train, standard bus seat, saver air fare, hatchback cab
 *   comfort – the cheapest route upgraded: AC 3-tier, AC sleeper bus, flexi fare, sedan, and a
 *             cab to and from the station or airport instead of metro and autos
 *   luxury  – the fastest route: first AC, premium sleeper bus, business class, SUV, cabs
 * Real class fares from the timetable are used where we have them; otherwise typical Indian
 * Railways / airline / bus price ratios, and the note says the fare is estimated.
 * Seats are paid per traveller; a cab or auto is shared (one car per 4 people).
 */
import { roadKm } from '../lib/geo';
import { loadData } from '../lib/data';
import type { Itinerary, Leg, Mode } from '../types';
import { roadFare } from './planner';

export type Style = 'budget' | 'comfort' | 'luxury';

export interface TierTravel {
  /** The route as this style takes it (upgraded fares and cab legs). */
  option: Itinerary;
  /** Average cost per traveller, one way. */
  perPerson: number;
  /** The whole group, there and back. */
  total: number;
  /** "AC 3-tier train · AC sleeper bus · cab to the station" */
  summary: string;
  /** True if any fare here is a ratio estimate rather than a timetable fare. */
  estimated: boolean;
}

const MAIN: Mode[] = ['TRAIN', 'FLIGHT', 'INTERCITY_BUS'];
const VEHICLE: Mode[] = ['CAB', 'AUTO', 'BIKE_TAXI', 'EV_DRIVE'];
const LOCAL: Mode[] = ['WALK', 'METRO', 'BUS', 'AUTO', 'BIKE_TAXI', 'CAB'];
/** Cab legs longer than this are outstation (highway) cabs. */
const OUTSTATION_KM = 40;
const PEOPLE_PER_CAR = 4;

/** Typical Indian Railways fares relative to sleeper (SL) and second sitting (2S). */
const SLEEPER_FAMILY: Record<string, number> = { SL: 1, '3A': 2.65, '2A': 3.8, '1A': 6.3 };
const CHAIR_FAMILY: Record<string, number> = { '2S': 1, CC: 3.7, EC: 7 };
const CLASS_NAME: Record<string, string> = {
  SL: 'Sleeper',
  '3A': 'AC 3-tier',
  '2A': 'AC 2-tier',
  '1A': 'First AC',
  '2S': 'Second sitting',
  CC: 'AC chair car',
  EC: 'Executive chair car',
};
/** Classes to ride in per style, best first (the first one the train has a fare for wins). */
const TRAIN_CLASS: Record<Style, { sleeper: string[]; chair: string[] }> = {
  budget: { sleeper: ['SL'], chair: ['2S'] },
  comfort: { sleeper: ['3A'], chair: ['CC'] },
  luxury: { sleeper: ['1A', '2A'], chair: ['EC', 'CC'] },
};
const BUS: Record<Style, { name: string; x: number }> = {
  budget: { name: 'Standard seat', x: 1 },
  comfort: { name: 'AC sleeper', x: 1.5 },
  luxury: { name: 'Premium AC sleeper (Volvo/Scania)', x: 2.1 },
};
const FLIGHT: Record<Style, { name: string; x: number }> = {
  budget: { name: 'Saver fare', x: 1 },
  comfort: { name: 'Flexi fare (seat, meal, free changes)', x: 1.25 },
  luxury: { name: 'Business class', x: 3 },
};
const CAR: Record<Style, { name: string; x: number }> = {
  budget: { name: 'Hatchback', x: 1 },
  comfort: { name: 'Sedan', x: 1.15 },
  luxury: { name: 'SUV (Innova class)', x: 1.5 },
};

interface TrainRow {
  serviceNo: string;
  classes: { code: string; fare: number }[];
}
let trains: Map<string, TrainRow> | null = null;
const trainRow = (no?: string) => {
  trains ??= new Map(loadData<TrainRow[]>('trains.json').map((t) => [t.serviceNo, t]));
  return no ? trains.get(no) : undefined;
};

let legSeq = 0;
const withNote = (leg: Leg, cost: number, label: string): Leg => ({
  ...leg,
  cost: Math.round(cost),
  notes: leg.notes ? `${leg.notes.split(' · ')[0]} · ${label}` : label,
});

/** One leg in this style's class: [leg, label, estimated]. */
function upgrade(leg: Leg, style: Style): [Leg, string | null, boolean] {
  if (leg.mode === 'TRAIN') {
    const row = trainRow(leg.serviceNo);
    const baseCode = leg.notes?.split(' · ').pop() ?? 'SL';
    const chair = baseCode in CHAIR_FAMILY;
    const family = chair ? CHAIR_FAMILY : SLEEPER_FAMILY;
    const wanted = chair ? TRAIN_CLASS[style].chair : TRAIN_CLASS[style].sleeper;
    const real = wanted.map((c) => row?.classes.find((x) => x.code === c)).find(Boolean);
    if (real) {
      const label = `${CLASS_NAME[real.code]} (${real.code})`;
      return [withNote(leg, real.fare, label), `${label} train`, false];
    }
    const code = wanted[0];
    const cost = (leg.cost * family[code]) / (family[baseCode] ?? 1);
    const label = `${CLASS_NAME[code]} (${code})`;
    return [withNote(leg, cost, `${label}, est.`), `${label} train`, true];
  }
  if (leg.mode === 'INTERCITY_BUS') {
    const b = BUS[style];
    return [
      withNote(leg, leg.cost * b.x, b.x === 1 ? b.name : `${b.name}, est.`),
      `${b.name} bus`,
      b.x !== 1,
    ];
  }
  if (leg.mode === 'FLIGHT') {
    const f = FLIGHT[style];
    return [
      withNote(leg, leg.cost * f.x, f.x === 1 ? f.name : `${f.name}, est.`),
      `flight (${f.name})`,
      f.x !== 1,
    ];
  }
  if (leg.mode === 'CAB' && (leg.distanceKm ?? 0) > OUTSTATION_KM) {
    const c = CAR[style];
    return [
      { ...leg, cost: Math.round(leg.cost * c.x), provider: `Outstation cab · ${c.name}` },
      `${c.name} outstation cab`,
      c.x !== 1,
    ];
  }
  return [leg, null, false];
}

/** Replaces walking, metro, bus and auto legs with one cab over the same stretch. */
function cabInstead(legs: Leg[]): Leg[] {
  if (legs.length === 0 || legs.every((l) => l.mode === 'CAB' || l.mode === 'WALK')) return legs;
  const first = legs[0];
  const last = legs[legs.length - 1];
  const km = roadKm(first.from, last.to);
  if (km < 0.5) return legs;
  return [
    {
      id: `leg-hol-${++legSeq}`,
      mode: 'CAB',
      from: first.from,
      to: last.to,
      departAt: first.departAt,
      arriveAt: last.arriveAt,
      durationMins: legs.reduce((s, l) => s + l.durationMins, 0),
      cost: Math.round(roadFare('CAB', km)),
      distanceKm: Math.round(km * 10) / 10,
      provider: 'Cab',
      status: 'ON_TIME',
    },
  ];
}

/** Picks the route for a style and prices it for the group. */
export function travelForStyle(
  options: Itinerary[],
  style: Style,
  travellers: number,
): TierTravel | null {
  if (!options.length) return null;
  const base =
    style === 'luxury'
      ? [...options].sort((a, b) => a.totalMins - b.totalMins || a.totalCost - b.totalCost)[0]
      : [...options].sort((a, b) => a.totalCost - b.totalCost || a.totalMins - b.totalMins)[0];

  // Comfort and luxury take a cab to and from the station or airport.
  let legs = base.legs;
  const mainAt = legs.findIndex((l) => MAIN.includes(l.mode));
  let cabbed = false;
  if (style !== 'budget' && mainAt >= 0) {
    let mainEnd = mainAt;
    while (mainEnd + 1 < legs.length && MAIN.includes(legs[mainEnd + 1].mode)) mainEnd++;
    const isLocal = (l: Leg) =>
      LOCAL.includes(l.mode) && !(l.mode === 'CAB' && (l.distanceKm ?? 0) > OUTSTATION_KM);
    // Only the local stretches next to the main service; an outstation cab stays as it is.
    let a = mainAt;
    while (a > 0 && isLocal(legs[a - 1])) a--;
    let b = mainEnd;
    while (b + 1 < legs.length && isLocal(legs[b + 1])) b++;
    const pre = legs.slice(a, mainAt);
    const post = legs.slice(mainEnd + 1, b + 1);
    const before = cabInstead(pre);
    const after = cabInstead(post);
    cabbed = before !== pre || after !== post;
    legs = [
      ...legs.slice(0, a),
      ...before,
      ...legs.slice(mainAt, mainEnd + 1),
      ...after,
      ...legs.slice(b + 1),
    ];
  }

  const labels: string[] = [];
  let estimated = false;
  legs = legs.map((l) => {
    const [leg, label, est] = upgrade(l, style);
    if (label && !labels.includes(label)) labels.push(label);
    estimated ||= est;
    return leg;
  });
  if (cabbed) labels.push('cab to and from the station or airport');

  // Seats are per person; vehicles are shared by the group.
  const cars = Math.ceil(travellers / PEOPLE_PER_CAR);
  const seats = legs.filter((l) => !VEHICLE.includes(l.mode)).reduce((s, l) => s + l.cost, 0);
  const vehicles = legs.filter((l) => VEHICLE.includes(l.mode)).reduce((s, l) => s + l.cost, 0);
  const groupOneWay = seats * travellers + vehicles * cars;
  const perPerson = Math.round(groupOneWay / travellers);
  return {
    option: {
      ...base,
      legs,
      totalCost: perPerson,
      totalMins: Math.round(
        (new Date(legs[legs.length - 1].arriveAt).getTime() -
          new Date(legs[0].departAt).getTime()) /
          60_000,
      ),
    },
    perPerson,
    total: groupOneWay * 2,
    summary: labels.length ? labels.join(' · ') : 'local transport',
    estimated,
  };
}
