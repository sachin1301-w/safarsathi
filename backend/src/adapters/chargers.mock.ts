import type { Charger as ChargerRow } from '@prisma/client';

import { prisma } from '../lib/db';
import { haversineKm } from '../lib/geo';
import type { Charger, ChargerStatus } from '../types';
import type { ChargerAdapter, ChargerQuery } from './types';

export function toCharger(row: ChargerRow): Charger {
  return {
    id: row.id,
    name: row.name,
    operator: row.operator,
    lat: row.lat,
    lng: row.lng,
    powerKw: row.powerKw,
    connectors: JSON.parse(row.connectors) as string[],
    status: row.status as ChargerStatus,
    pricePerKwh: row.pricePerKwh,
    lastVerified: row.lastVerified.toISOString(),
  };
}

/** Chargers seeded from data/chargers.pune.json into SQLite, with crowd reports. */
export class MockChargerAdapter implements ChargerAdapter {
  async findNear(q: ChargerQuery): Promise<Charger[]> {
    const rows = await prisma.charger.findMany();
    return rows
      .map(toCharger)
      .map((c) => ({ ...c, distanceKm: Math.round(haversineKm(q, c) * 10) / 10 }))
      .filter((c) => c.distanceKm <= q.radiusKm)
      .filter((c) => !q.connector || c.connectors.includes(q.connector))
      .filter((c) => !q.minKw || c.powerKw >= q.minKw)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getById(id: string) {
    const row = await prisma.charger.findUnique({
      where: { id },
      include: { reports: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!row) return null;
    return {
      ...toCharger(row),
      reports: row.reports.map((r) => ({
        id: r.id,
        status: r.status as ChargerStatus,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async report(id: string, userId: string, status: ChargerStatus, note?: string): Promise<Charger> {
    // The latest crowd report wins: it becomes the charger's live status.
    const [, row] = await prisma.$transaction([
      prisma.chargerReport.create({ data: { chargerId: id, userId, status, note } }),
      prisma.charger.update({ where: { id }, data: { status, lastVerified: new Date() } }),
    ]);
    return toCharger(row);
  }
}
