import { describe, expect, it } from 'vitest';

import { MockGeocodeAdapter } from '../src/adapters/geocode.mock';
import { MockScheduleAdapter } from '../src/adapters/schedules.mock';
import { MockTransitAdapter } from '../src/adapters/transit.mock';
import type { ChargerAdapter } from '../src/adapters/types';
import { planJourney, type PlannerDeps } from '../src/services/planner';
import { applyDisruption } from '../src/services/replanner';

const noChargers: ChargerAdapter = {
  findNear: async () => [],
  getById: async () => null,
  report: async () => {
    throw new Error('not used');
  },
};
const deps: PlannerDeps = {
  geocode: new MockGeocodeAdapter(),
  transit: new MockTransitAdapter(),
  schedules: new MockScheduleAdapter(),
  chargers: noChargers,
};
const ist = (hhmm: string) => new Date(`2026-10-02T${hhmm}:00+05:30`);
const arriveBy = ist('20:00');

/** The demo trip: Kothrud → Connaught Place by 8 PM on flight 6E-512. */
async function demoTrip() {
  const { options } = await planJourney(
    { from: 'Kothrud', to: 'Connaught Place', arriveBy, now: ist('10:00') },
    deps,
  );
  // Rebuild around 6E-512 by excluding every other Delhi flight.
  const others = new MockScheduleAdapter()
    .services()
    .filter((s) => s.mode === 'FLIGHT' && s.serviceNo !== '6E-512')
    .map((s) => s.serviceNo);
  const plan = await planJourney(
    {
      from: 'Kothrud',
      to: 'Connaught Place',
      arriveBy,
      now: ist('10:00'),
      excludeServices: others,
    },
    deps,
  );
  expect(options.length).toBeGreaterThan(0);
  const trip = plan.options.find((o) => o.legs.some((l) => l.serviceNo === '6E-512'))!;
  expect(trip).toBeDefined();
  return trip;
}

describe('applyDisruption', () => {
  it('a 90-minute delay on 6E-512 breaks the 8 PM deadline and pushes later legs back', async () => {
    const trip = await demoTrip();
    const flight = trip.legs.find((l) => l.mode === 'FLIGHT')!;
    const impact = applyDisruption(trip.legs, flight.id, { delayMins: 90 }, arriveBy);

    const delayed = impact.legs.find((l) => l.id === flight.id)!;
    expect(delayed.status).toBe('DELAYED');
    expect(delayed.delayMins).toBe(90);
    expect(new Date(delayed.departAt).getTime() - new Date(flight.departAt).getTime()).toBe(
      90 * 60_000,
    );
    // Nothing after the flight starts before the flight lands.
    const idx = impact.legs.indexOf(delayed);
    for (const later of impact.legs.slice(idx + 1)) {
      expect(new Date(later.departAt).getTime()).toBeGreaterThanOrEqual(
        new Date(delayed.arriveAt).getTime(),
      );
    }
    expect(impact.missesDeadline).toBe(true);
    expect(impact.broken).toBe(true);
    expect(impact.message).toMatch(/flight 6E-512 is 90 min late.*miss your 8:00 PM deadline/);
  });

  it('a short delay that still arrives on time is not broken', async () => {
    const trip = await demoTrip();
    const flight = trip.legs.find((l) => l.mode === 'FLIGHT')!;
    const impact = applyDisruption(trip.legs, flight.id, { delayMins: 10 }, arriveBy);
    expect(impact.broken).toBe(false);
    expect(impact.message).toMatch(/still arrive by/);
  });

  it('a delayed first leg that misses the flight boarding buffer breaks the connection', async () => {
    const trip = await demoTrip();
    const first = trip.legs[0];
    const impact = applyDisruption(trip.legs, first.id, { delayMins: 45 }, arriveBy);
    expect(impact.broken).toBe(true);
    expect(impact.missedLeg?.serviceNo).toBe('6E-512');
  });

  it('replanning without the delayed flight still finds an option that arrives on time', async () => {
    const { options } = await planJourney(
      {
        from: 'Kothrud',
        to: 'Connaught Place',
        arriveBy,
        now: ist('12:30'),
        excludeServices: ['6E-512'],
      },
      deps,
    );
    const onTime = options.filter((o) => o.onTime);
    expect(onTime.length).toBeGreaterThan(0);
    expect(onTime.some((o) => o.legs.some((l) => l.serviceNo === 'QP-1406'))).toBe(true);
    for (const o of options) expect(o.legs.some((l) => l.serviceNo === '6E-512')).toBe(false);
  });
});
