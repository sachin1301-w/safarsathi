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

const chunks = <T>(xs: T[], n: number) =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export async function importOsmIndia(prisma: PrismaClient) {
  // Curated (non-OSM) entries win over OSM duplicates at the same spot.
  const curatedChargers = await prisma.charger.findMany({
    where: { NOT: { id: { startsWith: 'osm-' } } },
  });
  const chargers = optionalData<ChargerRow>('chargers.india.json').filter(
    (c) => !curatedChargers.some((p) => haversineKm(p, c) < DUPLICATE_KM),
  );
  // Only add chargers that aren't there yet, so crowd-reported status survives a re-import.
  const savedChargers = new Set(
    (
      await prisma.charger.findMany({ where: { id: { startsWith: 'osm-' } }, select: { id: true } })
    ).map((r) => r.id),
  );
  const newChargers = chargers.filter((c) => !savedChargers.has(c.id));
  for (const batch of chunks(newChargers, 500))
    await prisma.charger.createMany({
      data: batch.map((c) => ({ ...c, lastVerified: new Date(c.lastVerified) })) as never,
    });

  const curatedLots = await prisma.parkingLot.findMany({
    where: { NOT: { id: { startsWith: 'osm-' } } },
  });
  const lots = optionalData<LotRow>('parking.india.json').filter(
    (l) => !curatedLots.some((p) => haversineKm(p, l) < DUPLICATE_KM),
  );
  const savedLots = new Set(
    (
      await prisma.parkingLot.findMany({
        where: { id: { startsWith: 'osm-' } },
        select: { id: true },
      })
    ).map((r) => r.id),
  );
  const newLots = lots.filter((l) => !savedLots.has(l.id));
  for (const batch of chunks(newLots, 500))
    await prisma.parkingLot.createMany({ data: batch as never });
  return { chargers: newChargers.length, lots: newLots.length };
}

// Run directly: npx tsx scripts/import-osm-india.ts
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/import-osm-india.ts')) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const n = await importOsmIndia(prisma);
  console.log(`Added ${n.chargers} chargers and ${n.lots} parking lots from OpenStreetMap.`);
  await prisma.$disconnect();
}
