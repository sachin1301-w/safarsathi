import type { ParkingLot as ParkingRow } from '@prisma/client';

import { prisma } from '../lib/db';
import { haversineKm } from '../lib/geo';
import type { ParkingLot, ParkingType } from '../types';
import type { ParkingAdapter } from './types';

export function toParkingLot(row: ParkingRow): ParkingLot {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    totalSpots: row.totalSpots,
    ratePerHour: row.ratePerHour,
    type: row.type as ParkingType,
    hourlyPattern: JSON.parse(row.hourlyPattern) as number[],
    hasEvCharging: row.hasEvCharging,
  };
}

const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (n: number) =>
  Array.from({ length: n }, () => ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)]).join('');

/** Parking lots seeded from data/parking.pune.json. Reservations are mock (no payment). */
export class MockParkingAdapter implements ParkingAdapter {
  async findNear(lat: number, lng: number, radiusKm: number): Promise<ParkingLot[]> {
    const rows = await prisma.parkingLot.findMany();
    return rows
      .map(toParkingLot)
      .map((p) => ({ ...p, distanceKm: Math.round(haversineKm({ lat, lng }, p) * 10) / 10 }))
      .filter((p) => p.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getById(id: string) {
    const row = await prisma.parkingLot.findUnique({ where: { id } });
    return row ? toParkingLot(row) : null;
  }

  async reserve(lotId: string, userId: string, arriveAt: Date, hours: number) {
    const lot = await prisma.parkingLot.findUniqueOrThrow({ where: { id: lotId } });
    const amount = Math.round(lot.ratePerHour * hours);
    const reservationId = `PRK-${code(6)}`;
    await prisma.parkingReservation.create({
      data: { id: reservationId, lotId, userId, arriveAt, hours, amount },
    });
    return { reservationId, amount };
  }
}
