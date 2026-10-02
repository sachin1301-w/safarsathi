import { Router } from 'express';
import { z } from 'zod';

import { parking } from '../adapters';
import { DEMO_USER_ID } from '../lib/db';
import { HttpError, notFound, queryNumber, validate } from '../lib/http';
import { parseTime } from '../lib/time';
import { withPrediction } from '../services/parkingPredictor';

export const parkingRouter = Router();

const timeString = z.string().transform((s, ctx) => {
  const d = parseTime(s);
  if (!d) {
    ctx.addIssue({ code: 'custom', message: 'not a valid time' });
    return z.NEVER;
  }
  return d;
});

const nearQuery = z.object({
  lat: queryNumber().min(-90).max(90),
  lng: queryNumber().min(-180).max(180),
  radiusKm: queryNumber().positive().max(50).default(3),
  arriveAt: timeString.optional(),
});

parkingRouter.get('/parking', async (req, res) => {
  const q = validate(nearQuery, req.query);
  const at = q.arriveAt ?? new Date();
  const lots = await parking.findNear(q.lat, q.lng, q.radiusKm);
  res.json(lots.map((lot) => withPrediction(lot, at)));
});

const reserveBody = z.object({
  arriveAt: timeString,
  hours: z.number().positive().max(24),
});

parkingRouter.post('/parking/:id/reserve', async (req, res) => {
  const body = validate(reserveBody, req.body);
  const lot = await parking.getById(req.params.id);
  if (!lot) throw notFound('Parking lot');
  if (withPrediction(lot, body.arriveAt).predictedFreeSpots === 0) {
    throw new HttpError(409, 'This lot is predicted to be full at that time');
  }
  res.status(201).json(await parking.reserve(lot.id, DEMO_USER_ID, body.arriveAt, body.hours));
});
