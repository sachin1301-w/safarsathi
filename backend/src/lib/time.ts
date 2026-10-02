// All schedules are in Indian Standard Time (UTC+05:30, no DST), whatever the server's timezone.
const IST_OFFSET_MS = 330 * 60_000;

export const MIN = 60_000;

export const addMins = (d: Date, mins: number) => new Date(d.getTime() + mins * MIN);
export const diffMins = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / MIN);

/** Calendar fields of `d` as seen on an IST wall clock. */
export function istParts(d: Date) {
  const s = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth(),
    day: s.getUTCDate(),
    hour: s.getUTCHours(),
    minute: s.getUTCMinutes(),
  };
}

export const istHour = (d: Date) => istParts(d).hour;

/** The instant at IST wall-clock "HH:MM" on the IST calendar day of `base`, shifted by `dayOffset` days. */
export function atIst(base: Date, hhmm: string, dayOffset = 0): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const p = istParts(base);
  return new Date(Date.UTC(p.year, p.month, p.day + dayOffset, h, m) - IST_OFFSET_MS);
}

/**
 * Parses a time from the API or the LLM. Accepts ISO strings (with or without offset;
 * offset-less is treated as IST) and bare "HH:MM" / "6 pm" style times meaning today in IST.
 */
export function parseTime(input: string, now = new Date()): Date | null {
  const s = input.trim().toLowerCase();
  const clock = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (clock) {
    let h = Number(clock[1]);
    const m = Number(clock[2] ?? 0);
    if (clock[3] === 'pm' && h < 12) h += 12;
    if (clock[3] === 'am' && h === 12) h = 0;
    if (h > 23 || m > 59) return null;
    return atIst(now, `${h}:${String(m).padStart(2, '0')}`);
  }
  const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(input.trim());
  const d = new Date(hasZone ? input : `${input.trim()}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2:10 PM" in IST. */
export function formatIst(d: Date): string {
  const { hour, minute } = istParts(d);
  const h12 = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Peak traffic in Indian cities: 8–11 AM and 5–9 PM IST. */
export function isPeak(d: Date): boolean {
  const h = istHour(d);
  return (h >= 8 && h < 11) || (h >= 17 && h < 21);
}
