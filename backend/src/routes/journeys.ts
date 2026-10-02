import { Router } from 'express';
import { z } from 'zod';

import { HttpError, notFound, validate } from '../lib/http';
import { parseTime } from '../lib/time';
import { PlanError } from '../services/planner';
import { getTrip, planForUser, saveItinerary } from '../services/trips';

export const journeysRouter = Router();

const timeString = z.string().transform((s, ctx) => {
  const d = parseTime(s);
  if (!d) {
    ctx.addIssue({ code: 'custom', message: 'not a valid time' });
    return z.NEVER;
  }
  return d;
});

const placeInput = z.union([
  z.string().trim().min(1).max(120),
  z.object({ name: z.string().min(1), lat: z.number(), lng: z.number() }),
]);

const optionLabel = z.enum(['FASTEST', 'CHEAPEST', 'GREENEST']);

export const planBody = z.object({
  from: placeInput,
  to: placeInput,
  arriveBy: timeString.optional(),
  departAt: timeString.optional(),
  preference: optionLabel.optional(),
  useEv: z.boolean().optional(),
});

journeysRouter.post('/journeys/plan', async (req, res) => {
  const body = validate(planBody, req.body);
  try {
    const result = await planForUser(body);
    res.json(result);
  } catch (err) {
    if (err instanceof PlanError) throw new HttpError(422, err.message);
    throw err;
  }
});

const point = z.object({ name: z.string(), lat: z.number(), lng: z.number() });
const legSchema = z.object({
  id: z.string(),
  mode: z.enum([
    'WALK',
    'METRO',
    'BUS',
    'AUTO',
    'BIKE_TAXI',
    'CAB',
    'TRAIN',
    'FLIGHT',
    'INTERCITY_BUS',
    'EV_DRIVE',
  ]),
  from: point,
  to: point,
  departAt: z.string(),
  arriveAt: z.string(),
  durationMins: z.number(),
  cost: z.number(),
  provider: z.string().optional(),
  serviceNo: z.string().optional(),
  bookingRef: z.string().optional(),
  chargerStopId: z.string().optional(),
  status: z.enum(['ON_TIME', 'DELAYED', 'CANCELLED']),
  delayMins: z.number().optional(),
  distanceKm: z.number().optional(),
  notes: z.string().optional(),
});
const itinerarySchema = z.object({
  label: optionLabel,
  badges: z.array(optionLabel).default([]),
  title: z.string(),
  legs: z.array(legSchema).min(1),
  totalMins: z.number(),
  totalCost: z.number(),
  co2SavedKg: z.number(),
  arriveBy: z.string().optional(),
  onTime: z.boolean().optional(),
  replacesTripId: z.string().optional(),
});

/** Saves a planned itinerary as a trip (status PLANNED). */
journeysRouter.post('/trips', async (req, res) => {
  const itinerary = validate(itinerarySchema, req.body);
  res.status(201).json(await saveItinerary(itinerary));
});

journeysRouter.get('/trips/:id', async (req, res) => {
  const trip = await getTrip(req.params.id);
  if (!trip) throw notFound('Trip');
  res.json(trip);
});
