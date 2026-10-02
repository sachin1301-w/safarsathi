import { Router } from 'express';
import { z } from 'zod';

import { describeAdapters, geocode } from '../adapters';
import { DEMO_USER_ID, prisma } from '../lib/db';
import { validate } from '../lib/http';
import { LANGUAGE_CODES, LANGUAGES } from '../lib/languages';

export const profileRouter = Router();

export async function getProfile() {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID } });
  return {
    id: user.id,
    name: user.name,
    language: user.language,
    hasEv: user.hasEv,
    evRangeKm: user.evRangeKm,
    evConnector: user.evConnector,
    evBatteryPct: user.evBatteryPct,
    home: user.homePlaceId ? (geocode.byId(user.homePlaceId) ?? null) : null,
    office: user.officePlaceId ? (geocode.byId(user.officePlaceId) ?? null) : null,
  };
}

profileRouter.get('/me', async (_req, res) => {
  res.json({ ...(await getProfile()), services: describeAdapters(), languages: LANGUAGES });
});

const patchBody = z.object({
  language: z.enum(LANGUAGE_CODES).optional(),
  evBatteryPct: z.number().int().min(0).max(100).optional(),
});

profileRouter.patch('/me', async (req, res) => {
  const body = validate(patchBody, req.body);
  await prisma.user.update({ where: { id: DEMO_USER_ID }, data: body });
  res.json(await getProfile());
});

const placesQuery = z.object({ q: z.string().trim().min(1).max(100) });

profileRouter.get('/places', (req, res) => {
  const { q } = validate(placesQuery, req.query);
  res.json(geocode.search(q, 6));
});
