import { loadData } from '../lib/data';
import type { IntercityService, ScheduleAdapter } from './types';

interface TrainRow {
  serviceNo: string;
  name: string;
  from: string;
  to: string;
  departs: string;
  durationMins: number;
  classes: { code: string; fare: number }[];
}
interface FlightRow {
  serviceNo: string;
  airline: string;
  from: string;
  to: string;
  departs: string;
  durationMins: number;
  fare: number;
}
interface BusRow {
  serviceNo: string;
  operator: string;
  from: string;
  to: string;
  departures: string[];
  durationMins: number;
  fare: number;
}

/**
 * Timetables for trains, flights and intercity buses from data/*.json.
 * Swap for an authorised IRCTC partner, airline or bus aggregator API later.
 */
export class MockScheduleAdapter implements ScheduleAdapter {
  private all: IntercityService[];

  constructor() {
    const trains = loadData<TrainRow[]>('trains.json').map((t): IntercityService => {
      const cheapest = [...t.classes].sort((a, b) => a.fare - b.fare)[0];
      return {
        mode: 'TRAIN',
        serviceNo: t.serviceNo,
        name: `${t.serviceNo} ${t.name}`,
        provider: 'IRCTC (mock)',
        fromPlaceId: t.from,
        toPlaceId: t.to,
        departures: [t.departs],
        durationMins: t.durationMins,
        fare: cheapest.fare,
        fareClass: cheapest.code,
      };
    });
    const flights = loadData<FlightRow[]>('flights.json').map((f): IntercityService => ({
      mode: 'FLIGHT',
      serviceNo: f.serviceNo,
      name: `${f.airline} ${f.serviceNo}`,
      provider: f.airline,
      fromPlaceId: f.from,
      toPlaceId: f.to,
      departures: [f.departs],
      durationMins: f.durationMins,
      fare: f.fare,
    }));
    const buses = loadData<BusRow[]>('buses.json').map((b): IntercityService => ({
      mode: 'INTERCITY_BUS',
      serviceNo: b.serviceNo,
      name: b.operator,
      provider: b.operator,
      fromPlaceId: b.from,
      toPlaceId: b.to,
      departures: b.departures,
      durationMins: b.durationMins,
      fare: b.fare,
    }));
    this.all = [...trains, ...flights, ...buses];
  }

  services() {
    return this.all;
  }
}
