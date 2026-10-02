import { Router } from 'express';
import { z } from 'zod';

import { HttpError, validate } from '../lib/http';
import { currentUserId } from '../lib/auth';
import { addClient } from '../lib/sse';
import { PlanError } from '../services/planner';
import {
  activeAlerts,
  disruptTrip,
  dismissAlert,
  ReplanError,
  replanTrip,
} from '../services/replanner';

export const alertsRouter = Router();

const asHttp = (err: unknown) => {
  if (err instanceof ReplanError) return new HttpError(err.status, err.message);
  if (err instanceof PlanError) return new HttpError(422, err.message);
  return err;
};

const disruptBody = z.object({
  tripId: z.string().min(1),
  legId: z.string().min(1),
  delayMins: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .optional(),
  cancel: z.boolean().optional(),
});

/** Demo only: simulate a delay (or cancellation) on one leg of a trip. */
alertsRouter.post('/demo/disrupt', async (req, res) => {
  const body = validate(disruptBody, req.body);
  if (!body.cancel && !body.delayMins) throw new HttpError(400, 'Give delayMins or cancel: true');
  try {
    const { impact } = await disruptTrip(
      body.tripId,
      body.legId,
      body.cancel ? { cancelled: true } : { delayMins: body.delayMins! },
    );
    res.json({ ok: true, broken: impact.broken, message: impact.message });
  } catch (err) {
    throw asHttp(err);
  }
});

const replanBody = z.object({ disruptedLegId: z.string().optional() });

alertsRouter.post('/journeys/:tripId/replan', async (req, res) => {
  const body = validate(replanBody, req.body ?? {});
  try {
    const { message, options } = await replanTrip(req.params.tripId, body.disruptedLegId);
    res.json({ message, options });
  } catch (err) {
    throw asHttp(err);
  }
});

alertsRouter.get('/alerts/stream', (_req, res) => {
  addClient(res, currentUserId());
});

alertsRouter.get('/alerts/active', async (_req, res) => {
  res.json(await activeAlerts());
});

alertsRouter.post('/alerts/:tripId/dismiss', async (req, res) => {
  await dismissAlert(req.params.tripId);
  res.json({ ok: true });
});
