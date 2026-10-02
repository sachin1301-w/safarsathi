/**
 * Loads data/chargers.india.json and data/parking.india.json (from fetch-osm-india.ts) into the
 * database without touching users or trips. The seed calls this too.
 *
 *   npx tsx scripts/import-osm-india.ts
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { PrismaClient } from '@prisma/client';

import { loadData } from '../src/lib/data';
import { haversineKm } from '../src/lib/geo';

const DUPLICATE_KM = 0.1;

function optionalData<T>(file: string): T[] {
  return existsSync(join(import.meta.dirname, '..', 'data', file)) ? loadData<T[]>(file) : [];
}

type ChargerRow = { id: string; lat: number; lng: number; lastVerified: string } & Record<
  string,
  unknown
>;
type LotRow = { id: string; lat: number; lng: number } & Record<string, unknown>;

export async function importOsmIndia(prisma: PrismaClient) {
  // Curated (non-OSM) entries win over OSM duplicates at the same spot.
  const curatedChargers = await prisma.charger.findMany({
    where: { NOT: { id: { startsWith: 'osm-' } } },
  });
  const chargers = optionalData<ChargerRow>('chargers.india.json').filter(
    (c) => !curatedChargers.some((p) => haversineKm(p, c) < DUPLICATE_KM),
  );
  for (const { id, ...c } of chargers) {
    const data = { ...c, lastVerified: new Date(c.lastVerified) } as never;
    // Keep crowd-reported status on chargers that are already there.
    await prisma.charger.upsert({
      where: { id },
      create: { id, ...(data as object) } as never,
      update: {},
    });
  }

  const curatedLots = await prisma.parkingLot.findMany({
    where: { NOT: { id: { startsWith: 'osm-' } } },
  });
  const lots = optionalData<LotRow>('parking.india.json').filter(
    (l) => !curatedLots.some((p) => haversineKm(p, l) < DUPLICATE_KM),
  );
  for (const { id, ...l } of lots) {
    await prisma.parkingLot.upsert({
      where: { id },
      create: { id, ...l } as never,
      update: l as never,
    });
  }
  return { chargers: chargers.length, lots: lots.length };
}

// Run directly: npx tsx scripts/import-osm-india.ts
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/import-osm-india.ts')) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const n = await importOsmIndia(prisma);
  console.log(`Imported ${n.chargers} chargers and ${n.lots} parking lots from OpenStreetMap.`);
  await prisma.$disconnect();
}
