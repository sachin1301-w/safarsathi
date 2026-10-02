/**
 * Rule-based assistant used when there is no ANTHROPIC_API_KEY, when DEMO_OFFLINE=true,
 * or when the API is unreachable. It understands the demo's main requests (plan a trip,
 * EV trip, chargers, parking) and answers from the same tools, so every fact is real data.
 */
import { geocode } from '../adapters';
import { atIst, formatIst } from '../lib/time';
import type { Card, Itinerary, Place } from '../types';
import type { ChatResult, ChatTurn } from './agent';
import { runTool } from './tools';

type Lang = 'en' | 'hi' | 'mr';

const T: Record<Lang, Record<string, (v: Record<string, string | number>) => string>> = {
  en: {
    plan: (v) =>
      `Here are your options from ${v.from} to ${v.to}. Fastest: leave ${v.leave}, arrive ${v.arrive}, ${v.cost}. Cheapest is ${v.cheap}.`,
    late: (v) =>
      `None of the options reaches ${v.to} by your deadline; the earliest arrival is ${v.arrive}.`,
    ev: (v) =>
      `Your EV trip to ${v.to} takes about ${v.time}${v.stop ? ` with a charging stop at ${v.stop}` : ', no charging stop needed'}.`,
    chargers: (v) =>
      `${v.count} chargers near ${v.near}, ${v.working} working right now. Nearest working: ${v.name}, ${v.kw} kW.`,
    noChargers: (v) => `I couldn't find chargers near ${v.near}.`,
    parking: (v) =>
      `Nearest parking to ${v.near}: ${v.name}, about ${v.free} spots free, ₹${v.rate} an hour.`,
    noParking: (v) => `I couldn't find parking near ${v.near}.`,
    replan: (v) =>
      `${v.message} Best new plan: leave ${v.leave}, arrive ${v.arrive}, ${v.cost}${v.onTime ? ', still on time' : ''}. Tap it to switch.`,
    help: () =>
      'I can plan trips, find EV chargers and parking. Try "Kothrud to Pune Airport by 6 pm" or "chargers near Baner".',
    error: (v) => `${v.message}`,
  },
  hi: {
    plan: (v) =>
      `${v.from} से ${v.to} तक के विकल्प ये रहे। सबसे तेज़: ${v.leave} पर निकलें, ${v.arrive} तक पहुँचें, ${v.cost}। सबसे सस्ता ${v.cheap} का है।`,
    late: (v) => `कोई भी विकल्प समय पर ${v.to} नहीं पहुँचता; सबसे जल्दी ${v.arrive} तक पहुँचेंगे।`,
    ev: (v) =>
      `${v.to} तक आपकी EV यात्रा लगभग ${v.time} की है${v.stop ? `, ${v.stop} पर चार्जिंग स्टॉप के साथ` : ', चार्जिंग की ज़रूरत नहीं'}।`,
    chargers: (v) =>
      `${v.near} के पास ${v.count} चार्जर हैं, अभी ${v.working} चालू हैं। सबसे नज़दीकी चालू: ${v.name}, ${v.kw} kW।`,
    noChargers: (v) => `${v.near} के पास कोई चार्जर नहीं मिला।`,
    parking: (v) =>
      `${v.near} के पास सबसे नज़दीकी पार्किंग: ${v.name}, लगभग ${v.free} जगह खाली, ₹${v.rate} प्रति घंटा।`,
    noParking: (v) => `${v.near} के पास पार्किंग नहीं मिली।`,
    replan: (v) =>
      `${v.message} नई योजना: ${v.leave} पर निकलें, ${v.arrive} तक पहुँचें, ${v.cost}${v.onTime ? ', समय पर' : ''}। बदलने के लिए उस पर टैप करें।`,
    help: () =>
      'मैं यात्रा की योजना, EV चार्जर और पार्किंग ढूँढने में मदद कर सकता हूँ। जैसे: "Kothrud to Pune Airport by 6 pm"।',
    error: (v) => `${v.message}`,
  },
  mr: {
    plan: (v) =>
      `${v.from} ते ${v.to} साठी हे पर्याय आहेत. सर्वात जलद: ${v.leave} ला निघा, ${v.arrive} ला पोहोचा, ${v.cost}. सर्वात स्वस्त ${v.cheap} आहे.`,
    late: (v) => `कोणताही पर्याय वेळेत ${v.to} ला पोहोचत नाही; सर्वात लवकर ${v.arrive} ला पोहोचाल.`,
    ev: (v) =>
      `${v.to} पर्यंतचा तुमचा EV प्रवास सुमारे ${v.time} आहे${v.stop ? `, ${v.stop} येथे चार्जिंग थांबा` : ', चार्जिंगची गरज नाही'}.`,
    chargers: (v) =>
      `${v.near} जवळ ${v.count} चार्जर आहेत, सध्या ${v.working} चालू आहेत. सर्वात जवळचा चालू: ${v.name}, ${v.kw} kW.`,
    noChargers: (v) => `${v.near} जवळ चार्जर सापडले नाहीत.`,
    parking: (v) =>
      `${v.near} जवळचे पार्किंग: ${v.name}, सुमारे ${v.free} जागा मोकळ्या, ₹${v.rate} प्रति तास.`,
    noParking: (v) => `${v.near} जवळ पार्किंग सापडले नाही.`,
    replan: (v) =>
      `${v.message} नवीन योजना: ${v.leave} ला निघा, ${v.arrive} ला पोहोचा, ${v.cost}${v.onTime ? ', वेळेत' : ''}. बदलण्यासाठी त्यावर टॅप करा.`,
    help: () =>
      'मी प्रवासाचे नियोजन, EV चार्जर आणि पार्किंग शोधण्यात मदत करू शकतो. उदा.: "Kothrud to Pune Airport by 6 pm".',
    error: (v) => `${v.message}`,
  },
};

const langOf = (code: string): Lang =>
  code.startsWith('hi') ? 'hi' : code.startsWith('mr') ? 'mr' : 'en';

/** Places mentioned in the text, in the order they appear (longest match wins). */
function placesIn(text: string): { place: Place; at: number }[] {
  const lower = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')} `;
  const found: { place: Place; at: number; end: number }[] = [];
  for (const place of geocode.all()) {
    for (const alias of [place.name.toLowerCase(), ...place.aliases]) {
      const at = lower.indexOf(` ${alias} `);
      if (at >= 0) found.push({ place, at, end: at + alias.length + 1 });
    }
  }
  found.sort((a, b) => a.at - b.at || b.end - a.end);
  const out: typeof found = [];
  for (const f of found) {
    const overlaps = out.some((o) => f.at < o.end && o.at < f.end);
    if (!overlaps && !out.some((o) => o.place.id === f.place.id)) out.push(f);
  }
  return out;
}

function deadline(text: string): string | undefined {
  const m = text.toLowerCase().match(/\bby\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return undefined;
  let h = Number(m[1]);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (!m[3] && h < 8) h += 12; // "by 6" in a travel request almost always means evening
  const now = new Date();
  let d = atIst(now, `${h}:${m[2] ?? '00'}`);
  if (d < now) d = atIst(now, `${h}:${m[2] ?? '00'}`, 1);
  return d.toISOString();
}

const fmtCost = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtMins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

/** A short reply describing tool cards, for when an LLM returns cards but no text. */
export function describeCards(cards: Card[], language: string): string {
  const t = T[langOf(language)];
  const its = cards.filter((c) => c.type === 'itinerary').map((c) => c.data as Itinerary);
  if (its.length) {
    const fastest = its.find((i) => i.badges.includes('FASTEST')) ?? its[0];
    const cheapest = its.find((i) => i.badges.includes('CHEAPEST')) ?? fastest;
    return t.plan({
      from: fastest.legs[0].from.name,
      to: fastest.legs.at(-1)!.to.name,
      leave: formatIst(new Date(fastest.legs[0].departAt)),
      arrive: formatIst(new Date(fastest.legs.at(-1)!.arriveAt)),
      cost: fmtCost(fastest.totalCost),
      cheap: fmtCost(cheapest.totalCost),
    });
  }
  const chargers = cards.find((c) => c.type === 'chargers');
  if (chargers && chargers.type === 'chargers' && chargers.data.length) {
    const working = chargers.data.filter((c) => c.status === 'WORKING');
    const best = working[0] ?? chargers.data[0];
    return t.chargers({
      near: 'you',
      count: chargers.data.length,
      working: working.length,
      name: best.name,
      kw: best.powerKw,
    });
  }
  const parking = cards.find((c) => c.type === 'parking');
  if (parking && parking.type === 'parking' && parking.data.length) {
    const best = parking.data.find((p) => (p.predictedFreeSpots ?? 0) > 0) ?? parking.data[0];
    return t.parking({
      near: 'you',
      name: best.name,
      free: best.predictedFreeSpots ?? 0,
      rate: best.ratePerHour,
    });
  }
  return t.help({});
}

export async function runOfflineAgent(history: ChatTurn[], language: string): Promise<ChatResult> {
  const lang = langOf(language);
  const t = T[lang];
  const text = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
  const lower = text.toLowerCase();
  const mentioned = placesIn(text);
  const nearName = mentioned[0]?.place.name;
  const done = (reply: string, cards: Card[] = []): ChatResult => ({
    reply,
    cards,
    mode: 'offline',
    provider: 'offline',
  });

  // "Fix my trip" from the disruption banner carries the trip id.
  const tripId = text.match(/trip id[:\s]+([a-z0-9]+)/i)?.[1];
  if (tripId) {
    const out = await runTool('replan_trip', { tripId });
    if (out.isError) return done(t.error({ message: (out.result as { error: string }).error }));
    const r = out.result as { disruption: string };
    const best = (out.cards ?? []).map((c) => c.data as Itinerary)[0];
    if (!best) return done(r.disruption);
    return done(
      t.replan({
        message: r.disruption.replace(/ Tap to see[^.]*\./, ''),
        leave: formatIst(new Date(best.legs[0].departAt)),
        arrive: formatIst(new Date(best.legs.at(-1)!.arriveAt)),
        cost: fmtCost(best.totalCost),
        onTime: best.onTime === false ? '' : 'yes',
      }),
      out.cards,
    );
  }

  const wantsParking = /park|पार्क/.test(lower);
  const wantsChargers = /charg|चार्ज/.test(lower) && !/\btrip\b|यात्रा|प्रवास/.test(lower);
  const wantsEvTrip =
    /\bev\b|electric|इलेक्ट्रिक/.test(lower) &&
    (/\btrip\b|drive|यात्रा|प्रवास/.test(lower) || mentioned.length > 0);

  if (wantsParking) {
    const out = await runTool('find_parking', { near: nearName });
    if (out.isError) return done(t.error({ message: (out.result as { error: string }).error }));
    const r = out.result as {
      near: string;
      lots: { name: string; predictedFreeSpots: number; ratePerHourInr: number }[];
    };
    if (!r.lots.length) return done(t.noParking({ near: r.near }));
    const best = r.lots.find((l) => l.predictedFreeSpots > 0) ?? r.lots[0];
    return done(
      t.parking({
        near: r.near,
        name: best.name,
        free: best.predictedFreeSpots,
        rate: best.ratePerHourInr,
      }),
      out.cards,
    );
  }

  if (wantsChargers && !wantsEvTrip) {
    const out = await runTool('find_chargers', { near: nearName });
    if (out.isError) return done(t.error({ message: (out.result as { error: string }).error }));
    const r = out.result as {
      near: string;
      count: number;
      chargers: { name: string; status: string; powerKw: number }[];
    };
    const working = r.chargers.filter((c) => c.status === 'WORKING');
    if (!r.chargers.length) return done(t.noChargers({ near: r.near }));
    const best = working[0] ?? r.chargers[0];
    return done(
      t.chargers({
        near: r.near,
        count: r.count,
        working: working.length,
        name: best.name,
        kw: best.powerKw,
      }),
      out.cards,
    );
  }

  if (mentioned.length === 0) return done(t.help({}));

  // Destination = the place after "to" (or the last one); origin = after "from" (or home).
  const fromIdx = lower.indexOf(' from ');
  const fromPlace =
    fromIdx >= 0
      ? mentioned.find((m) => m.at >= fromIdx)
      : mentioned.length > 1
        ? mentioned[0]
        : undefined;
  const toPlace = mentioned.filter((m) => m !== fromPlace).at(-1) ?? mentioned.at(-1)!;
  const out = await runTool('plan_journey', {
    from: fromPlace && fromPlace !== toPlace ? fromPlace.place.name : 'home',
    to: toPlace.place.name,
    arriveBy: deadline(text),
    useEv: wantsEvTrip || undefined,
  });
  if (out.isError) return done(t.error({ message: (out.result as { error: string }).error }));

  const itineraries = (out.cards ?? []).map((c) => c.data as Itinerary);
  const fastest = itineraries.find((i) => i.badges.includes('FASTEST')) ?? itineraries[0];
  const cheapest = itineraries.find((i) => i.badges.includes('CHEAPEST')) ?? fastest;
  const to = toPlace.place.name;
  if (wantsEvTrip) {
    const stopLeg = fastest.legs.find((l) => l.chargerStopId);
    return done(
      t.ev({ to, time: fmtMins(fastest.totalMins), stop: stopLeg?.to.name ?? '' }),
      out.cards,
    );
  }
  if (fastest.onTime === false) {
    return done(
      t.late({ to, arrive: formatIst(new Date(fastest.legs.at(-1)!.arriveAt)) }),
      out.cards,
    );
  }
  return done(
    t.plan({
      from: fastest.legs[0].from.name,
      to,
      leave: formatIst(new Date(fastest.legs[0].departAt)),
      arrive: formatIst(new Date(fastest.legs.at(-1)!.arriveAt)),
      cost: fmtCost(fastest.totalCost),
      cheap: fmtCost(cheapest.totalCost),
    }),
    out.cards,
  );
}
