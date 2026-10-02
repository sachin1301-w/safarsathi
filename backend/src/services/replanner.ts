/**
 * Disruptions: apply a delay or cancellation to a trip, check whether connections still work,
 * and plan a way out from where the user is now.
 */
import { DEMO_USER_ID, prisma } from '../lib/db';
import { broadcast } from '../lib/sse';
import { addMins, diffMins, formatIst } from '../lib/time';
import type { Itinerary, Leg, Mode, Point, Trip } from '../types';
import { getTrip, planForUser, toTrip } from './trips';

/** Minimum time between arriving and a scheduled departure (spec: metro 5, train 20, flight 60). */
export const MIN_BUFFER_MINS: Partial<Record<Mode, number>> = {
  METRO: 5,
  TRAIN: 20,
  FLIGHT: 60,
  INTERCITY_BUS: 15,
};

/** Services that leave at a fixed time whether you're there or not. Everything else just starts later. */
const FIXED_MODES: Mode[] = ['TRAIN', 'FLIGHT', 'INTERCITY_BUS'];

export class ReplanError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Impact {
  legs: Leg[];
  broken: boolean;
  /** The scheduled service the user can no longer make, if any. */
  missedLeg?: Leg;
  missesDeadline: boolean;
  newArrival: Date;
  message: string;
}

function serviceLabel(leg: Leg): string {
  switch (leg.mode) {
    case 'FLIGHT':
      return `flight ${leg.serviceNo}`;
    case 'TRAIN':
      return `train ${leg.serviceNo}`;
    case 'INTERCITY_BUS':
      return `${leg.provider ?? 'intercity'} bus`;
    case 'METRO':
      return `${leg.serviceNo ?? 'metro'}`;
    case 'BUS':
      return `bus ${leg.serviceNo ?? ''}`.trim();
    default:
      return leg.mode.toLowerCase().replace('_', ' ');
  }
}

/**
 * Marks a leg DELAYED (or CANCELLED), pushes later legs back, and checks every connection
 * against its minimum buffer and the trip's deadline. Pure: returns new legs, doesn't save.
 */
export function applyDisruption(
  legs: Leg[],
  legId: string,
  change: { delayMins: number } | { cancelled: true },
  arriveBy?: Date,
): Impact {
  const idx = legs.findIndex((l) => l.id === legId);
  if (idx < 0) throw new ReplanError(404, 'Leg not found');
  const out = legs.map((l) => ({ ...l }));
  const leg = out[idx];
  const label = serviceLabel(leg);

  if ('cancelled' in change) {
    leg.status = 'CANCELLED';
    const newArrival = new Date(out.at(-1)!.arriveAt);
    return {
      legs: out,
      broken: true,
      missedLeg: leg,
      missesDeadline: false,
      newArrival,
      message: `Your ${label} is cancelled. Tap to see a new plan.`,
    };
  }

  const d = change.delayMins;
  leg.status = 'DELAYED';
  leg.delayMins = (leg.delayMins ?? 0) + d;
  leg.departAt = addMins(new Date(leg.departAt), d).toISOString();
  leg.arriveAt = addMins(new Date(leg.arriveAt), d).toISOString();

  let missedLeg: Leg | undefined;
  for (let j = idx + 1; j < out.length; j++) {
    const prevArrive = new Date(out[j - 1].arriveAt);
    const next = out[j];
    const depart = new Date(next.departAt);
    if (FIXED_MODES.includes(next.mode)) {
      const buffer = MIN_BUFFER_MINS[next.mode] ?? 0;
      if (addMins(prevArrive, buffer) > depart) {
        missedLeg ??= next;
      }
    } else {
      // Metro, cabs, walks: you simply take a later one, keeping the original gap
      // (e.g. 15 minutes to get out of the airport).
      const gapMins = diffMins(new Date(legs[j].departAt), new Date(legs[j - 1].arriveAt));
      const earliest = addMins(prevArrive, Math.max(0, gapMins));
      if (earliest > depart) {
        const shift = diffMins(earliest, depart);
        next.departAt = addMins(depart, shift).toISOString();
        next.arriveAt = addMins(new Date(next.arriveAt), shift).toISOString();
      }
    }
  }

  const newArrival = new Date(out.at(-1)!.arriveAt);
  const missesDeadline = !!arriveBy && newArrival > arriveBy;
  const broken = !!missedLeg || missesDeadline;
  let message = `Your ${label} is ${d} min late.`;
  if (missedLeg)
    message += ` You will miss your ${serviceLabel(missedLeg)}. Tap to see a new plan.`;
  else if (missesDeadline) {
    message += ` You will miss your ${formatIst(arriveBy!)} deadline. Tap to see a faster option.`;
  } else message += ` You'll still arrive by ${formatIst(newArrival)}.`;

  return { legs: out, broken, missedLeg, missesDeadline, newArrival, message };
}

/** Applies a delay to a saved trip, saves it, and pushes an alert to the app over SSE. */
export async function disruptTrip(
  tripId: string,
  legId: string,
  change: { delayMins: number } | { cancelled: true },
): Promise<{ trip: Trip; impact: Impact }> {
  const trip = await getTrip(tripId);
  if (!trip) throw new ReplanError(404, 'Trip not found');
  const impact = applyDisruption(
    trip.legs,
    legId,
    change,
    trip.arriveBy ? new Date(trip.arriveBy) : undefined,
  );
  const row = await prisma.trip.update({
    where: { id: trip.id },
    data: {
      legs: JSON.stringify(impact.legs),
      status: impact.broken ? 'DISRUPTED' : trip.status,
      alertMessage: impact.message,
    },
  });
  const updated = toTrip(row);
  broadcast('disruption', {
    tripId: trip.id,
    legId,
    title: trip.title,
    message: impact.message,
    broken: impact.broken,
  });
  return { trip: updated, impact };
}

/**
 * New options from the user's current point to the final destination, keeping the original
 * deadline. The disrupted service is excluded. On-time options first, then the cheapest.
 */
export async function replanTrip(
  tripId: string,
  disruptedLegId?: string,
  now = new Date(),
): Promise<{ trip: Trip; message: string; options: Itinerary[] }> {
  const trip = await getTrip(tripId);
  if (!trip) throw new ReplanError(404, 'Trip not found');
  const disruptedIdx = disruptedLegId
    ? trip.legs.findIndex((l) => l.id === disruptedLegId)
    : trip.legs.findIndex((l) => l.status !== 'ON_TIME');
  if (disruptedIdx < 0) throw new ReplanError(422, 'This trip has no disruption to fix.');
  const disrupted = trip.legs[disruptedIdx];

  // Simulated progress: legs that have already departed are done, so start from the first one
  // that hasn't (but no later than the disrupted leg).
  const notStarted = trip.legs.findIndex((l) => new Date(l.departAt) > now);
  const startIdx = notStarted < 0 ? disruptedIdx : Math.min(notStarted, disruptedIdx);
  const from: Point = trip.legs[startIdx].from;
  const to: Point = trip.legs.at(-1)!.to;
  const arriveBy = trip.arriveBy ? new Date(trip.arriveBy) : undefined;

  const result = await planForUser({
    from,
    to,
    arriveBy,
    excludeServices:
      FIXED_MODES.includes(disrupted.mode) && disrupted.serviceNo ? [disrupted.serviceNo] : [],
    useEv: trip.legs.some((l) => l.mode === 'EV_DRIVE'),
    now,
  });

  const options = result.options
    .map((o) => ({ ...o, title: trip.title, replacesTripId: trip.id }))
    .sort(
      (a, b) =>
        Number(b.onTime !== false) - Number(a.onTime !== false) || a.totalCost - b.totalCost,
    );
  return {
    trip,
    message: trip.alertMessage ?? `Your ${serviceLabel(disrupted)} is disrupted.`,
    options,
  };
}

export async function activeAlerts() {
  const rows = await prisma.trip.findMany({
    where: {
      userId: DEMO_USER_ID,
      alertMessage: { not: null },
      status: { notIn: ['REPLACED', 'DONE'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    tripId: r.id,
    title: r.title,
    message: r.alertMessage!,
    broken: r.status === 'DISRUPTED',
  }));
}

export async function dismissAlert(tripId: string) {
  await prisma.trip.updateMany({
    where: { id: tripId, userId: DEMO_USER_ID },
    data: { alertMessage: null },
  });
}
