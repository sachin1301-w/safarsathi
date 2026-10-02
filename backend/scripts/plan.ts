/**
 * Prints planner output for a trip, for checking routes without the app.
 *   npm run plan -- "Kothrud" "Connaught Place" [arriveBy HH:MM] [--ev]
 */
import 'dotenv/config';

import { chargers, geocode, schedules, transit } from '../src/adapters';
import { prisma } from '../src/lib/db';
import { formatIst, parseTime } from '../src/lib/time';
import { planJourney } from '../src/services/planner';

const args = process.argv.slice(2);
const useEv = args.includes('--ev');
const [from, to, arriveBy] = args.filter((a) => a !== '--ev');
if (!from || !to) {
  console.error('Usage: npm run plan -- <from> <to> [arriveBy HH:MM] [--ev]');
  process.exit(1);
}

const { options } = await planJourney(
  {
    from,
    to,
    arriveBy: arriveBy ? (parseTime(arriveBy) ?? undefined) : undefined,
    useEv: useEv || undefined,
    ev: useEv ? { rangeKm: 300, batteryPct: 30, connector: 'CCS2' } : null,
  },
  { geocode, transit, schedules, chargers },
);

for (const o of options) {
  const badges = o.badges.length ? o.badges.join(' + ') : 'OTHER OPTION';
  console.log(`\n${badges}  ₹${o.totalCost}  ${o.totalMins} min  saves ${o.co2SavedKg} kg CO2`);
  for (const l of o.legs) {
    const when = `${formatIst(new Date(l.departAt))}–${formatIst(new Date(l.arriveAt))}`;
    console.log(
      `  ${when.padEnd(20)} ${l.mode.padEnd(13)} ${l.from.name} → ${l.to.name}  ₹${l.cost}  ${l.notes ?? ''}`,
    );
  }
}
await prisma.$disconnect();
