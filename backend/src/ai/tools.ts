// Tool schemas (Zod, also used to generate the JSON Schema sent to Claude) and their handlers.
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { chargers, findPlaces, geocode, lookupPlace, memory, parking } from '../adapters';
import { currentUserId } from '../lib/auth';
import { prisma } from '../lib/db';
import { formatIst, parseTime } from '../lib/time';
import { withPrediction } from '../services/parkingPredictor';
import { planHoliday } from '../services/holiday';
import { PlanError } from '../services/planner';
import { bookAll, BookingError, bookLeg } from '../services/bookings';
import { ReplanError, replanTrip } from '../services/replanner';
import { getTrip, planForUser, saveItinerary } from '../services/trips';
import type { Card, Itinerary, Place, Point } from '../types';
import { getOption, rememberOption } from './planCache';
import { currentLocation, isCurrentLocation } from './requestContext';

export interface ToolOutput {
  /** What Claude sees: compact JSON, no coordinates it doesn't need. */
  result: unknown;
  /** What the app renders under the reply. */
  cards?: Card[];
}

export class ToolInputError extends Error {}

interface ToolDef<S extends z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>) => Promise<ToolOutput>;
}

const tool = <S extends z.ZodType>(def: ToolDef<S>) => def;

const isoTime = z
  .string()
  .describe('ISO 8601 date-time with +05:30 offset, e.g. 2026-10-02T20:00:00+05:30');

function parseOptionalTime(s: string | undefined, field: string): Date | undefined {
  if (!s) return undefined;
  const d = parseTime(s);
  if (!d) throw new ToolInputError(`${field} is not a valid time: ${s}`);
  return d;
}

/** "current location" becomes the user's live position when the app sent one. */
function resolveOrigin(from: string): string | Point {
  const here = currentLocation();
  return isCurrentLocation(from) && here
    ? { name: 'Current location', lat: here.lat, lng: here.lng }
    : from;
}

async function resolveNear(near: string | undefined): Promise<Place> {
  const here = currentLocation();
  if (here && (!near || isCurrentLocation(near))) {
    const name = here.near ? `your location (near ${here.near.name})` : 'your location';
    return {
      id: 'current',
      name,
      city: here.near?.city ?? 'Unknown',
      lat: here.lat,
      lng: here.lng,
      type: 'AREA',
      aliases: [],
    };
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUserId() } });
  const q = (near ?? 'home').trim().toLowerCase();
  const savedId = q === 'home' ? user.homePlaceId : q === 'office' ? user.officePlaceId : null;
  const place =
    (savedId && geocode.byId(savedId)) || (await lookupPlace(near ?? 'Kothrud').catch(() => null));
  if (!place) throw new ToolInputError(`Unknown place "${near}". Try geocode_place first.`);
  return place;
}

/** Itinerary as Claude sees it: times in IST, no coordinates. */
function summarizeItinerary(it: Itinerary, optionId: string) {
  return {
    optionId,
    badges: it.badges,
    title: it.title,
    leave: formatIst(new Date(it.legs[0].departAt)),
    arrive: formatIst(new Date(it.legs.at(-1)!.arriveAt)),
    totalMins: it.totalMins,
    totalCostInr: it.totalCost,
    co2SavedKg: it.co2SavedKg,
    onTime: it.onTime,
    legs: it.legs.map((l) => ({
      mode: l.mode,
      from: l.from.name,
      to: l.to.name,
      depart: formatIst(new Date(l.departAt)),
      arrive: formatIst(new Date(l.arriveAt)),
      service: l.serviceNo,
      provider: l.provider,
      costInr: l.cost,
      notes: l.notes,
    })),
  };
}

export const TOOLS = [
  tool({
    name: 'plan_journey',
    description:
      'Plan a door-to-door journey and get up to three options (fastest, cheapest, greenest) with every leg, time and price. Places can be names ("Kothrud", "Connaught Place, Delhi", "Pune Airport") or "home"/"office".',
    schema: z.object({
      from: z
        .string()
        .describe(
          'Start place name, "home"/"office", or "current location". If the user did not say, use "current location" when their location is known (see context), else "home".',
        ),
      to: z.string().describe('Destination place name, or "home"/"office"'),
      arriveBy: isoTime.optional().describe('Latest arrival time, if the user has a deadline'),
      departAt: isoTime.optional().describe('Earliest departure time, if the user gave one'),
      preference: z
        .enum(['FASTEST', 'CHEAPEST', 'GREENEST'])
        .optional()
        .describe('Show this option first'),
      useEv: z
        .boolean()
        .optional()
        .describe("true to plan with the user's own EV (adds charger stops)"),
    }),
    async run(input) {
      const result = await planForUser({
        from: resolveOrigin(input.from),
        to: resolveOrigin(input.to),
        arriveBy: parseOptionalTime(input.arriveBy, 'arriveBy'),
        departAt: parseOptionalTime(input.departAt, 'departAt'),
        preference: input.preference,
        useEv: input.useEv,
      });
      const options = result.options.map((it) => ({ it, optionId: rememberOption(it) }));
      return {
        result: {
          from: result.from.name,
          to: result.to.name,
          options: options.map(({ it, optionId }) => summarizeItinerary(it, optionId)),
        },
        cards: options.map(({ it }) => ({ type: 'itinerary', data: it })),
      };
    },
  }),

  tool({
    name: 'find_chargers',
    description:
      'Find public EV chargers near a place, with live status (WORKING, BUSY, BROKEN), power, connectors and price.',
    schema: z.object({
      near: z
        .string()
        .optional()
        .describe(
          'Place name, "home"/"office" or "current location". Defaults to where the user is now, else home.',
        ),
      radiusKm: z.number().positive().max(300).optional().describe('Search radius, default 25 km'),
      connector: z.string().optional().describe('CCS2, Type2, GBT, Bharat AC001 or CHAdeMO'),
      minKw: z.number().nonnegative().optional().describe('Minimum charging power in kW'),
    }),
    async run(input) {
      const place = await resolveNear(input.near);
      const list = await chargers.findNear({
        lat: place.lat,
        lng: place.lng,
        radiusKm: input.radiusKm ?? 25,
        connector: input.connector,
        minKw: input.minKw,
      });
      const top = list.slice(0, 8);
      return {
        result: {
          near: place.name,
          count: list.length,
          chargers: top.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            powerKw: c.powerKw,
            connectors: c.connectors,
            pricePerKwh: c.pricePerKwh,
            distanceKm: c.distanceKm,
          })),
        },
        cards: top.length ? [{ type: 'chargers', data: top }] : [],
      };
    },
  }),

  tool({
    name: 'find_parking',
    description:
      'Find parking lots near a place with predicted free spots at the arrival time, rate per hour and EV charging.',
    schema: z.object({
      near: z
        .string()
        .optional()
        .describe(
          'Place name, "home"/"office" or "current location". Defaults to where the user is now, else home.',
        ),
      arriveAt: isoTime.optional().describe('When the user will arrive; defaults to now'),
    }),
    async run(input) {
      const place = await resolveNear(input.near);
      const at = parseOptionalTime(input.arriveAt, 'arriveAt') ?? new Date();
      const lots = (await parking.findNear(place.lat, place.lng, 15))
        .map((l) => withPrediction(l, at))
        .slice(0, 6);
      return {
        result: {
          near: place.name,
          arriveAt: formatIst(at),
          lots: lots.map((l) => ({
            name: l.name,
            distanceKm: l.distanceKm,
            predictedFreeSpots: l.predictedFreeSpots,
            totalSpots: l.totalSpots,
            ratePerHourInr: l.ratePerHour,
            hasEvCharging: l.hasEvCharging,
          })),
        },
        cards: lots.length ? [{ type: 'parking', data: lots }] : [],
      };
    },
  }),

  tool({
    name: 'plan_holiday',
    description:
      'Plan a holiday: N days at a destination. Returns the special places to visit (from Wikipedia), a day-by-day plan, hotel options and a full estimated budget (travel there and back, hotel, food, local travel, entry tickets). Use for requests like "5 days in Goa" or "plan a trip to Jaipur for 3 days".',
    schema: z.object({
      destination: z.string().describe('City or place, e.g. "Goa", "Jaipur", "Manali"'),
      days: z.number().int().min(1).max(14),
      travellers: z.number().int().min(1).max(12).optional().describe('Default 2'),
      style: z.enum(['budget', 'comfort', 'luxury']).optional().describe('Default comfort'),
    }),
    async run(input) {
      const plan = await planHoliday({
        destination: input.destination,
        days: input.days,
        travellers: input.travellers ?? 2,
        style: input.style ?? 'comfort',
      });
      return {
        result: {
          destination: `${plan.destination.name}, ${plan.destination.city}`,
          days: plan.days,
          travellers: plan.travellers,
          style: plan.style,
          mustSee: plan.highlights.map((s) => ({ name: s.name, about: s.description })),
          dayByDay: plan.itinerary.map((d) => ({
            day: d.day,
            places: d.sights.map((s) => s.name),
          })),
          hotels: plan.hotels.map((h) => ({ name: h.name, estPricePerNightInr: h.pricePerNight })),
          budgetInr: Object.fromEntries(plan.budget.lines.map((l) => [l.label, l.amount])),
          totalInr: plan.budget.total,
          perPersonInr: plan.budget.perPerson,
          note: 'Hotel, food, local travel and ticket amounts are estimates; travel is from the journey planner.',
        },
        cards: [
          {
            type: 'holiday',
            data: {
              destination: plan.destination.name,
              days: plan.days,
              travellers: plan.travellers,
              style: plan.style,
              total: plan.budget.total,
              perPerson: plan.budget.perPerson,
              highlights: plan.highlights.slice(0, 3).map((s) => s.name),
              photo: plan.highlights.find((s) => s.photo)?.photo,
            },
          },
        ],
      };
    },
  }),

  tool({
    name: 'book_leg',
    description:
      'Book a trip with the mock providers (trains get a 10-digit PNR, flights a 6-letter PNR; metro QR tickets and cabs too). Only call this after the user has confirmed. Pass an optionId from plan_journey or a saved tripId. Omit legId to book every bookable leg.',
    schema: z.object({
      tripId: z.string().describe('A saved trip id, or an optionId (opt_...) from plan_journey'),
      legId: z.string().optional().describe('One leg to book; omit to book all bookable legs'),
    }),
    async run({ tripId, legId }) {
      let id = tripId;
      if (tripId.startsWith('opt_')) {
        const option = getOption(tripId);
        if (!option) throw new ToolInputError('That option has expired. Plan the journey again.');
        id = (await saveItinerary(option)).id;
      }
      try {
        const trip = legId ? (await bookLeg(id, legId)).trip : await bookAll(id);
        const booked = trip.legs.filter((l) => l.bookingRef);
        return {
          result: {
            tripId: trip.id,
            status: trip.status,
            bookings: booked.map((l) => ({
              legId: l.id,
              mode: l.mode,
              service: l.serviceNo,
              bookingRef: l.bookingRef,
            })),
          },
          cards: booked.length
            ? [
                {
                  type: 'booking',
                  data: {
                    tripId: trip.id,
                    bookingRef: booked.map((l) => l.bookingRef).join(' · '),
                  },
                },
              ]
            : [],
        };
      } catch (err) {
        if (err instanceof BookingError) throw new ToolInputError(err.message);
        throw err;
      }
    },
  }),

  tool({
    name: 'replan_trip',
    description:
      "Fix a disrupted trip: returns what happened and new options from the user's current point to the destination, keeping the original deadline. On-time options come first.",
    schema: z.object({
      tripId: z.string(),
      disruptedLegId: z
        .string()
        .optional()
        .describe('Defaults to the first delayed or cancelled leg'),
    }),
    async run({ tripId, disruptedLegId }) {
      try {
        const { trip, message, options } = await replanTrip(tripId, disruptedLegId);
        const withIds = options.map((it) => ({ it, optionId: rememberOption(it) }));
        return {
          result: {
            disruption: message,
            deadline: trip.arriveBy ? formatIst(new Date(trip.arriveBy)) : null,
            options: withIds.map(({ it, optionId }) => summarizeItinerary(it, optionId)),
          },
          cards: withIds.map(({ it }) => ({ type: 'itinerary', data: it })),
        };
      } catch (err) {
        if (err instanceof ReplanError) throw new ToolInputError(err.message);
        throw err;
      }
    },
  }),

  tool({
    name: 'get_trip',
    description:
      "Get one of the user's saved trips by id, with leg status, delays and booking references.",
    schema: z.object({ tripId: z.string() }),
    async run({ tripId }) {
      const trip = await getTrip(tripId);
      if (!trip) throw new ToolInputError(`No trip with id ${tripId}`);
      return {
        result: {
          title: trip.title,
          totalMins: trip.totalMins,
          totalCostInr: trip.totalCost,
          co2SavedKg: trip.co2SavedKg,
          tripId: trip.id,
          status: trip.status,
          arriveBy: trip.arriveBy ? formatIst(new Date(trip.arriveBy)) : null,
          legs: trip.legs.map((l) => ({
            legId: l.id,
            mode: l.mode,
            from: l.from.name,
            to: l.to.name,
            depart: formatIst(new Date(l.departAt)),
            arrive: formatIst(new Date(l.arriveAt)),
            service: l.serviceNo,
            status: l.status,
            delayMins: l.delayMins,
            bookingRef: l.bookingRef,
          })),
        },
      };
    },
  }),

  tool({
    name: 'geocode_place',
    description:
      'Look up a place by name to check it exists and see its city. Returns up to 3 matches.',
    schema: z.object({ query: z.string() }),
    async run({ query }) {
      const matches = await findPlaces(query, 3);
      return { result: matches.map((p) => ({ name: p.name, city: p.city, type: p.type })) };
    },
  }),

  tool({
    name: 'remember',
    description:
      'Save a lasting fact or preference about the user to long-term memory (e.g. "Gym is at Balewadi High Street", "Avoids bike taxis").',
    schema: z.object({
      fact: z.string().min(3).max(300).describe('One self-contained sentence, in English'),
      kind: z.enum(['PLACE', 'PREFERENCE', 'NOTE']),
    }),
    async run({ fact, kind }) {
      await memory.remember(currentUserId(), kind, fact);
      return { result: { saved: true } };
    },
  }),

  tool({
    name: 'recall_memory',
    description: 'Search long-term memory for things the user told you before.',
    schema: z.object({ query: z.string() }),
    async run({ query }) {
      return { result: { memories: await memory.recall(currentUserId(), query) } };
    },
  }),
];

/** Tool definitions in the shape the Messages API expects. Order is fixed so the cache prefix stays stable. */
export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = TOOLS.map((t) => {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(t.schema) as Record<string, unknown>;
  return {
    name: t.name,
    description: t.description,
    input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
  };
});

/** Validates the model's input and runs the tool. Errors come back as text for the model. */
export async function runTool(
  name: string,
  input: unknown,
): Promise<ToolOutput & { isError?: boolean }> {
  const def = TOOLS.find((t) => t.name === name);
  if (!def) return { result: { error: `Unknown tool ${name}` }, isError: true };
  const parsed = def.schema.safeParse(input);
  if (!parsed.success) {
    return { result: { error: `Invalid input: ${parsed.error.message}` }, isError: true };
  }
  try {
    return await (def.run as (i: unknown) => Promise<ToolOutput>)(parsed.data);
  } catch (err) {
    if (err instanceof ToolInputError || err instanceof PlanError) {
      return { result: { error: err.message }, isError: true };
    }
    console.error(`Tool ${name} failed:`, err);
    return {
      result: { error: 'The tool failed unexpectedly. Try again or rephrase.' },
      isError: true,
    };
  }
}
