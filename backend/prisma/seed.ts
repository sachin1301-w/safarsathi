/**
 * Resets the database to the demo state: one demo user, chargers, parking lots and
 * starter memories. Safe to re-run before every demo (`npm run db:seed`).
 */
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import { importOsmIndia } from '../scripts/import-osm-india';
import { loadData } from '../src/lib/data';
import { hashPassword } from '../src/lib/auth';
import { DEMO_USER_ID } from '../src/lib/db';

/** Shown on the app's login screen as the demo account. */
const DEMO_EMAIL = 'demo@safarsathi.app';
const DEMO_PASSWORD = 'demo1234';

const prisma = new PrismaClient();

interface ChargerSeed {
  id: string;
  name: string;
  operator: string;
  lat: number;
  lng: number;
  powerKw: number;
  connectors: string[];
  status: string;
  pricePerKwh: number;
  lastVerified: string;
}

interface ParkingSeed {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalSpots: number;
  ratePerHour: number;
  type: string;
  hourlyPattern: number[];
  hasEvCharging: boolean;
}

const STARTER_MEMORIES: { kind: string; text: string }[] = [
  { kind: 'PLACE', text: 'Home is in Kothrud, Pune.' },
  { kind: 'PLACE', text: 'Office is at Hinjewadi Phase 1, Pune.' },
  { kind: 'PREFERENCE', text: 'Prefers the metro over cabs when the time difference is small.' },
  {
    kind: 'PREFERENCE',
    text: 'Drives an EV with a CCS2 connector and about 300 km of full-battery range.',
  },
  {
    kind: 'PREFERENCE',
    text: 'Prefers a window seat on flights and usually travels with one cabin bag.',
  },
];

/** Sends the starter memories to Cognee too, if configured, so recall works from the first chat. */
async function pushToCognee() {
  const url = process.env.COGNEE_API_URL?.trim().replace(/\/$/, '');
  const key = process.env.COGNEE_API_KEY?.trim();
  if (!url || !key) return;
  const form = new FormData();
  for (const m of STARTER_MEMORIES) form.append('raw_data', `[${m.kind}] ${m.text}`);
  form.append('datasetName', 'safarsathi');
  form.append('node_set', `user:${DEMO_USER_ID}`);
  form.append('run_in_background', 'true');
  try {
    const res = await fetch(`${url}/api/v1/remember`, {
      method: 'POST',
      headers: { 'X-Api-Key': key },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    console.log(
      res.ok
        ? 'Sent starter memories to Cognee.'
        : `Cognee rejected memories (${res.status}): ${await res.text()}`,
    );
  } catch (err) {
    console.warn('Could not reach Cognee; local memory still works:', (err as Error).message);
  }
}

async function main() {
  // Children first, then parents.
  await prisma.chargerReport.deleteMany();
  await prisma.parkingReservation.deleteMany();
  await prisma.memory.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.session.deleteMany();
  await prisma.charger.deleteMany();
  await prisma.parkingLot.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      id: DEMO_USER_ID,
      name: 'Aarav',
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      language: 'en-IN',
      hasEv: true,
      evRangeKm: 300,
      evConnector: 'CCS2',
      evBatteryPct: 30,
      homePlaceId: 'kothrud',
      officePlaceId: 'hinjewadi',
    },
  });

  const chargers = loadData<ChargerSeed[]>('chargers.pune.json');
  await prisma.charger.createMany({
    data: chargers.map((c) => ({
      ...c,
      connectors: JSON.stringify(c.connectors),
      lastVerified: new Date(c.lastVerified),
    })),
  });

  const lots = loadData<ParkingSeed[]>('parking.pune.json');
  await prisma.parkingLot.createMany({
    data: lots.map((p) => ({ ...p, hourlyPattern: JSON.stringify(p.hourlyPattern) })),
  });

  // All-India OpenStreetMap data from scripts/fetch-osm-india.ts.
  const india = await importOsmIndia(prisma);

  await prisma.memory.createMany({
    data: STARTER_MEMORIES.map((m) => ({ ...m, userId: DEMO_USER_ID })),
  });

  console.log(
    `Seeded 1 user (${DEMO_EMAIL} / ${DEMO_PASSWORD}), ${chargers.length + india.chargers} chargers, ${lots.length + india.lots} parking lots, ${STARTER_MEMORIES.length} memories.`,
  );
  await pushToCognee();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
