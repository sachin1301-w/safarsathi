import { describe, expect, it } from 'vitest';

import { MockBookingAdapter } from '../src/adapters/booking.mock';
import type { Leg, Mode } from '../src/types';

const leg = (mode: Mode): Leg => ({
  id: 'leg-1',
  mode,
  from: { name: 'A', lat: 0, lng: 0 },
  to: { name: 'B', lat: 0, lng: 0 },
  departAt: '2026-10-02T10:00:00Z',
  arriveAt: '2026-10-02T11:00:00Z',
  durationMins: 60,
  cost: 100,
  status: 'ON_TIME',
});

describe('MockBookingAdapter', () => {
  const adapter = new MockBookingAdapter();

  it('gives trains a 10-digit PNR and flights a 6-letter PNR', async () => {
    expect(await adapter.book(leg('TRAIN'))).toMatch(/^\d{10}$/);
    expect(await adapter.book(leg('FLIGHT'))).toMatch(/^[A-Z]{6}$/);
  });

  it('refuses legs that need no booking', async () => {
    await expect(adapter.book(leg('WALK'))).rejects.toThrow();
  });
});
