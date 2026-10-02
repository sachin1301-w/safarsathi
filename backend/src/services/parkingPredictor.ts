import { istHour, istParts } from '../lib/time';
import type { ParkingLot } from '../types';

/** Deterministic noise in [-0.1, 0.1] per lot and hour, so a refresh doesn't make numbers jump. */
function noise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967295) * 0.2 - 0.1;
}

/**
 * Predicted free spots = totalSpots × (1 − typical occupancy at that hour), ±10% noise.
 * Uses the lot's 24-hour occupancy pattern in IST.
 */
export function predictFreeSpots(lot: ParkingLot, at: Date): number {
  const hour = istHour(at);
  const { year, month, day } = istParts(at);
  const occupancy = lot.hourlyPattern[hour] ?? 0.5;
  const free =
    lot.totalSpots * (1 - occupancy) * (1 + noise(`${lot.id}:${year}-${month}-${day}:${hour}`));
  return Math.max(0, Math.min(lot.totalSpots, Math.round(free)));
}

export function withPrediction(lot: ParkingLot, at: Date): ParkingLot {
  return { ...lot, predictedFreeSpots: predictFreeSpots(lot, at) };
}
