import { roadKm, type LatLng } from '../lib/geo';
import type { Leg, Mode } from '../types';

/** kg CO2 per passenger-km. BIKE_TAXI isn't in the spec; a two-wheeler is roughly 0.04. */
export const CO2_PER_KM: Record<Mode, number> = {
  WALK: 0,
  METRO: 0.02,
  BUS: 0.03,
  AUTO: 0.07,
  BIKE_TAXI: 0.04,
  CAB: 0.17,
  TRAIN: 0.02,
  FLIGHT: 0.15,
  INTERCITY_BUS: 0.03,
  EV_DRIVE: 0.05,
};

const CAR_CO2_PER_KM = 0.17;

export const legCo2Kg = (leg: Pick<Leg, 'mode' | 'distanceKm'>) =>
  (leg.distanceKm ?? 0) * CO2_PER_KM[leg.mode];

/** CO2 saved versus driving the whole trip alone by petrol car, in kg (never negative). */
export function co2SavedKg(legs: Leg[], from: LatLng, to: LatLng): number {
  const baseline = roadKm(from, to) * CAR_CO2_PER_KM;
  const actual = legs.reduce((sum, leg) => sum + legCo2Kg(leg), 0);
  return Math.max(0, Math.round((baseline - actual) * 10) / 10);
}
