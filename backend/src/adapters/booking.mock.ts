import type { Leg, Mode } from '../types';
import type { BookingAdapter } from './types';

const DIGITS = '0123456789';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const pick = (chars: string, n: number) =>
  Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

/** Modes that have something to book. Walks and autos hailed on the street don't. */
export const BOOKABLE_MODES: Mode[] = ['TRAIN', 'FLIGHT', 'INTERCITY_BUS', 'METRO', 'CAB'];

/** Fake bookings: no money moves. Trains get a 10-digit PNR, flights a 6-letter PNR. */
export class MockBookingAdapter implements BookingAdapter {
  async book(leg: Leg): Promise<string> {
    await new Promise((r) => setTimeout(r, 150)); // feels like a network call
    switch (leg.mode) {
      case 'TRAIN':
        return pick(DIGITS, 10);
      case 'FLIGHT':
        return pick(LETTERS, 6);
      case 'INTERCITY_BUS':
        return `BUS${pick(DIGITS, 7)}`;
      case 'METRO':
        return `MQR-${pick(LETTERS + DIGITS, 6)}`;
      case 'CAB':
        return `RIDE-${pick(DIGITS, 6)}`;
      default:
        throw new Error(`${leg.mode} legs can't be booked`);
    }
  }
}
