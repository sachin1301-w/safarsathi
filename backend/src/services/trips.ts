import type { Trip as TripRow } from '@prisma/client';

import { chargers, geocode, schedules, transit } from '../adapters';
import { DEMO_USER_ID, prisma } from '../lib/db';
import type { Itinerary, Leg, OptionLabel, Trip } from '../types';
import { planJourney, type PlannerDeps, type PlanRequest } from './planner';

export const plannerDeps: PlannerDeps = { geocode, transit, schedules, chargers };

export function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    title: row.title,
    status: row.status as Trip['status'],
    option: row.option as OptionLabel,
    legs: JSON.parse(row.legs) as Leg[],
    totalMins: row.totalMins,
    totalCost: row.totalCost,
    co2SavedKg: row.co2SavedKg,
    arriveBy: row.arriveBy?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The demo user's EV and saved places, as planner input. */
export async function userPlanningContext(): Promise<Pick<PlanRequest, 'ev' | 'savedPlaces'>> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID } });
  const savedPlaces: Record<string, string> = {};
  if (user.homePlaceId) savedPlaces.home = user.homePlaceId;
  if (user.officePlaceId) savedPlaces.office = user.officePlaceId;
  const ev =
    user.hasEv && user.evRangeKm
      ? {
          rangeKm: user.evRangeKm,
          batteryPct: user.evBatteryPct ?? 80,
          connector: user.evConnector ?? undefined,
        }
      : null;
  return { ev, savedPlaces };
}

export async function planForUser(req: Omit<PlanRequest, 'ev' | 'savedPlaces'>) {
  return planJourney({ ...req, ...(await userPlanningContext()) }, plannerDeps);
}

/** Saves an itinerary as a PLANNED trip so it can be opened, booked and tracked. */
export async function saveItinerary(it: Itinerary): Promise<Trip> {
  const row = await prisma.trip.create({
    data: {
      userId: DEMO_USER_ID,
      title: it.title,
      status: 'PLANNED',
      option: it.label,
      legs: JSON.stringify(it.legs),
      totalMins: it.totalMins,
      totalCost: it.totalCost,
      co2SavedKg: it.co2SavedKg,
      arriveBy: it.arriveBy ? new Date(it.arriveBy) : null,
    },
  });
  return toTrip(row);
}

export async function getTrip(id: string): Promise<Trip | null> {
  const row = await prisma.trip.findFirst({ where: { id, userId: DEMO_USER_ID } });
  return row ? toTrip(row) : null;
}
