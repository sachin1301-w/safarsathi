import { booking, memory } from '../adapters';
import { BOOKABLE_MODES } from '../adapters/booking.mock';
import { DEMO_USER_ID, prisma } from '../lib/db';
import { formatIst } from '../lib/time';
import type { Leg, Trip } from '../types';
import { getTrip, toTrip } from './trips';

export class BookingError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const isBookable = (leg: Leg) => BOOKABLE_MODES.includes(leg.mode);

async function saveLegs(trip: Trip, legs: Leg[]): Promise<Trip> {
  const allBooked = legs.filter(isBookable).every((l) => l.bookingRef);
  const status = trip.status === 'PLANNED' && allBooked ? 'BOOKED' : trip.status;
  const row = await prisma.trip.update({
    where: { id: trip.id },
    data: { legs: JSON.stringify(legs), status },
  });
  return toTrip(row);
}

async function loadTrip(tripId: string): Promise<Trip> {
  const trip = await getTrip(tripId);
  if (!trip) throw new BookingError(404, 'Trip not found');
  return trip;
}

/** Books one leg with its (mock) provider. Booking an already-booked leg returns its reference. */
export async function bookLeg(
  tripId: string,
  legId: string,
): Promise<{ bookingRef: string; trip: Trip }> {
  const trip = await loadTrip(tripId);
  const leg = trip.legs.find((l) => l.id === legId);
  if (!leg) throw new BookingError(404, 'Leg not found');
  if (!isBookable(leg)) throw new BookingError(422, `${leg.mode} legs don't need booking`);
  if (leg.bookingRef) return { bookingRef: leg.bookingRef, trip };

  const bookingRef = await booking.book(leg);
  const legs = trip.legs.map((l) => (l.id === legId ? { ...l, bookingRef } : l));
  const updated = await saveLegs(trip, legs);
  await rememberBooking(updated);
  return { bookingRef, trip: updated };
}

/** Books every bookable leg that isn't booked yet. */
export async function bookAll(tripId: string): Promise<Trip> {
  const trip = await loadTrip(tripId);
  const legs: Leg[] = [];
  for (const leg of trip.legs) {
    legs.push(
      isBookable(leg) && !leg.bookingRef ? { ...leg, bookingRef: await booking.book(leg) } : leg,
    );
  }
  const updated = await saveLegs(trip, legs);
  await rememberBooking(updated);
  return updated;
}

/** Booked trips go to long-term memory so the copilot can talk about them later. */
async function rememberBooking(trip: Trip) {
  if (trip.status !== 'BOOKED') return;
  const services = trip.legs
    .filter(
      (l) =>
        l.bookingRef && (l.mode === 'FLIGHT' || l.mode === 'TRAIN' || l.mode === 'INTERCITY_BUS'),
    )
    .map((l) => `${l.mode.toLowerCase().replace('_', ' ')} ${l.serviceNo} (PNR ${l.bookingRef})`);
  const day = new Date(trip.legs[0].departAt).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
  const text = `Booked trip ${trip.title} on ${day}, leaving ${formatIst(new Date(trip.legs[0].departAt))}${
    services.length ? ` by ${services.join(', ')}` : ''
  }. Trip id ${trip.id}.`;
  await memory.remember(DEMO_USER_ID, 'TRIP', text).catch(() => undefined);
}

export async function listTrips(): Promise<Trip[]> {
  const rows = await prisma.trip.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toTrip);
}
