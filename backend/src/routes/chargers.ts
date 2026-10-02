import { Router } from 'express';
import { z } from 'zod';

import { chargers } from '../adapters';
import { DEMO_USER_ID, prisma } from '../lib/db';
import { notFound, queryNumber, validate } from '../lib/http';

export const chargersRouter = Router();

const nearQuery = z.object({
  lat: queryNumber().min(-90).max(90),
  lng: queryNumber().min(-180).max(180),
  radiusKm: queryNumber().positive().max(500).default(10),
  connector: z.string().min(1).optional(),
  minKw: queryNumber().nonnegative().optional(),
});

chargersRouter.get('/chargers', async (req, res) => {
  const q = validate(nearQuery, req.query);
  res.json(await chargers.findNear(q));
});

chargersRouter.get('/chargers/:id', async (req, res) => {
  const charger = await chargers.getById(req.params.id);
  if (!charger) throw notFound('Charger');
  res.json(charger);
});

const reportBody = z.object({
  status: z.enum(['WORKING', 'BUSY', 'BROKEN']),
  note: z.string().trim().max(280).optional(),
});

chargersRouter.post('/chargers/:id/report', async (req, res) => {
  const body = validate(reportBody, req.body);
  const exists = await prisma.charger.findUnique({ where: { id: req.params.id } });
  if (!exists) throw notFound('Charger');
  res.json(await chargers.report(req.params.id, DEMO_USER_ID, body.status, body.note || undefined));
});
