import { describe, expect, it } from 'vitest';

import { MockGeocodeAdapter } from '../src/adapters/geocode.mock';
import { MockScheduleAdapter } from '../src/adapters/schedules.mock';
import { MockTransitAdapter } from '../src/adapters/transit.mock';
import type { ChargerAdapter } from '../src/adapters/types';
import { haversineKm } from '../src/lib/geo';
import { loadData } from '../src/lib/data';
import { planJourney, PlanError, type PlannerDeps } from '../src/services/planner';
import type { Charger, Itinerary } from '../src/types';

/** Chargers straight from the seed file, so the tests need no database. */
const seedChargers = loadData<Charger[]>('chargers.pune.json');
const chargers: ChargerAdapter = {
  async findNear(q) {
    return seedChargers
      .filter((c) => haversineKm(q, c) <= q.radiusKm)
      .filter((c) => !q.connector || c.connectors.includes(q.connector))
      .filter((c) => !q.minKw || c.powerKw >= q.minKw);
  },
  async getById() {
    return null;
  },
  async report() {
    throw new Error('not used');
  },
};

const deps: PlannerDeps = {
  geocode: new MockGeocodeAdapter(),
  transit: new MockTransitAdapter(),
  schedules: new MockScheduleAdapter(),
  chargers,
};

/** IST wall-clock time on Fri 2 Oct 2026. */
const ist = (hhmm: string) => new Date(`2026-10-02T${hhmm}:00+05:30`);

function expectWellFormed(it: Itinerary) {
  expect(it.legs.length).toBeGreaterThan(0);
  for (let i = 0; i < it.legs.length; i++) {
    const leg = it.legs[i];
    expect(new Date(leg.arriveAt).getTime()).toBeGreaterThan(new Date(leg.departAt).getTime());
    if (i > 0) {
      // Legs never overlap and chain place to place.
      expect(new Date(leg.departAt).getTime()).toBeGreaterThanOrEqual(
        new Date(it.legs[i - 1].arriveAt).getTime(),
      );
      // Each leg starts where the last one ended (or a few steps away, e.g. terminal → station).
      expect(haversineKm(leg.from, it.legs[i - 1].to)).toBeLessThan(0.2);
    }
  }
  expect(it.totalCost).toBe(it.legs.reduce((s, l) => s + l.cost, 0));
  expect(it.co2SavedKg).toBeGreaterThanOrEqual(0);
}

describe('planJourney', () => {
  it('plans a city trip (Kothrud → Hinjewadi) with three distinct options', async () => {
    const { options, from, to } = await planJourney(
      { from: 'Kothrud', to: 'Hinjewadi', now: ist('13:00') },
      deps,
    );
    expect(from.id).toBe('kothrud');
    expect(to.id).toBe('hinjewadi');
    expect(options).toHaveLength(3);
    options.forEach(expectWellFormed);
    expect(new Set(options.map((o) => o.legs.map((l) => l.mode).join('>'))).size).toBe(3);

    // Every label is awarded exactly once, to an option that really wins that metric.
    const holder = (label: string) => options.filter((o) => o.badges.includes(label as never));
    for (const label of ['FASTEST', 'CHEAPEST', 'GREENEST']) expect(holder(label)).toHaveLength(1);
    const [fastest] = holder('FASTEST');
    const [cheapest] = holder('CHEAPEST');
    const [greenest] = holder('GREENEST');
    expect(fastest.totalMins).toBe(Math.min(...options.map((o) => o.totalMins)));
    expect(cheapest.totalCost).toBe(Math.min(...options.map((o) => o.totalCost)));
    expect(greenest.co2SavedKg).toBe(Math.max(...options.map((o) => o.co2SavedKg)));
    // Nothing leaves before "now".
    for (const o of options)
      expect(new Date(o.legs[0].departAt).getTime()).toBeGreaterThanOrEqual(ist('13:00').getTime());
  });

  it('plans Kothrud → Connaught Place by 8 PM with a flight and arrives on time', async () => {
    const arriveBy = ist('20:00');
    const { options } = await planJourney(
      { from: 'Kothrud', to: 'Connaught Place, Delhi', arriveBy, now: ist('10:00') },
      deps,
    );
    expect(options).toHaveLength(3);
    for (const o of options) {
      expectWellFormed(o);
      expect(o.onTime).toBe(true);
      expect(new Date(o.legs.at(-1)!.arriveAt).getTime()).toBeLessThanOrEqual(arriveBy.getTime());
      expect(o.legs[0].from.name).toBe('Kothrud');
      expect(o.legs.at(-1)!.to.name).toBe('Connaught Place');
      expect(o.legs.some((l) => l.mode === 'FLIGHT')).toBe(true);
    }
    // The flight leg keeps the 60-minute boarding buffer.
    const fastest = options[0];
    const flightIdx = fastest.legs.findIndex((l) => l.mode === 'FLIGHT');
    if (flightIdx > 0) {
      const gap =
        new Date(fastest.legs[flightIdx].departAt).getTime() -
        new Date(fastest.legs[flightIdx - 1].arriveAt).getTime();
      expect(gap).toBeGreaterThanOrEqual(60 * 60_000);
    }
    // The greenest option uses the metro at both ends: Pune Metro to the airport, Delhi Metro after.
    const greenest = options.find((o) => o.badges.includes('GREENEST'))!;
    const metros = greenest.legs.filter((l) => l.mode === 'METRO').map((l) => l.provider);
    expect(metros).toContain('Pune Metro');
    expect(metros).toContain('Delhi Metro');
  });

  it('adds a working charger stop for an EV trip to Mahabaleshwar at 30% battery', async () => {
    const { options } = await planJourney(
      {
        from: 'Kothrud',
        to: 'Mahabaleshwar',
        useEv: true,
        ev: { rangeKm: 300, batteryPct: 30, connector: 'CCS2' },
        now: ist('09:00'),
      },
      deps,
    );
    for (const o of options) {
      expectWellFormed(o);
      expect(o.legs.every((l) => l.mode === 'EV_DRIVE')).toBe(true);
      const stops = o.legs.filter((l) => l.chargerStopId);
      expect(stops.length).toBeGreaterThan(0);
      for (const s of stops) {
        const charger = seedChargers.find((c) => c.id === s.chargerStopId)!;
        expect(charger.status).toBe('WORKING');
        expect(charger.connectors).toContain('CCS2');
      }
    }
  });

  it('rejects unknown places', async () => {
    await expect(planJourney({ from: 'Kothrud', to: 'Atlantis' }, deps)).rejects.toBeInstanceOf(
      PlanError,
    );
  });
});
