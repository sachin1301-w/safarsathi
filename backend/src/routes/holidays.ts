import { Router } from 'express';
import { z } from 'zod';

import { currentUserId } from '../lib/auth';
import { prisma } from '../lib/db';
import { HttpError, validate } from '../lib/http';
import { planHoliday, type HolidayPlan } from '../services/holiday';

export const holidaysRouter = Router();

const style = z.enum(['budget', 'comfort', 'luxury']);

const planBody = z.object({
  destination: z.string().trim().min(2).max(80),
  days: z.number().int().min(1).max(14),
  travellers: z.number().int().min(1).max(12).default(2),
  style: style.default('comfort'),
  from: z
    .union([
      z.string().trim().min(1),
      z.object({ name: z.string(), lat: z.number(), lng: z.number() }),
    ])
    .optional(),
  startDate: z.coerce.date().optional(),
});

/** Plan a holiday (not saved). */
holidaysRouter.post('/holidays/plan', async (req, res) => {
  res.json(await planHoliday(validate(planBody, req.body)));
});

const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () =>
  Array.from({ length: 6 }, () => ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)]).join('');

const saveBody = z.object({
  // The plan the user saw; stored as-is (all prices in it are estimates or demo data).
  plan: z
    .object({
      destination: z.object({ name: z.string() }).passthrough(),
      days: z.number(),
      travellers: z.number(),
      style,
      hotels: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
      budget: z.object({ total: z.number() }).passthrough(),
    })
    .passthrough(),
  hotelId: z.string().optional(),
});

/** Save a holiday and (demo) book the chosen hotel. */
holidaysRouter.post('/holidays', async (req, res) => {
  const { plan, hotelId } = validate(saveBody, req.body);
  const hotel = hotelId ? plan.hotels.find((h) => h.id === hotelId) : undefined;
  if (hotelId && !hotel) throw new HttpError(400, 'That hotel is not part of this plan.');
  const row = await prisma.holiday.create({
    data: {
      userId: currentUserId(),
      destination: plan.destination.name,
      days: plan.days,
      travellers: plan.travellers,
      style: plan.style,
      plan: JSON.stringify(plan),
      totalBudget: plan.budget.total,
      hotelName: hotel?.name ?? null,
      hotelRef: hotel ? `HTL-${code()}` : null,
    },
  });
  res.status(201).json(toHoliday(row));
});

holidaysRouter.get('/holidays', async (_req, res) => {
  const rows = await prisma.holiday.findMany({
    where: { userId: currentUserId() },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map(toHoliday));
});

holidaysRouter.get('/holidays/:id', async (req, res) => {
  const row = await prisma.holiday.findFirst({
    where: { id: req.params.id, userId: currentUserId() },
  });
  if (!row) throw new HttpError(404, 'Holiday not found');
  res.json(toHoliday(row));
});

function toHoliday(row: {
  id: string;
  destination: string;
  days: number;
  travellers: number;
  style: string;
  plan: string;
  totalBudget: number;
  hotelName: string | null;
  hotelRef: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    destination: row.destination,
    days: row.days,
    travellers: row.travellers,
    style: row.style,
    totalBudget: row.totalBudget,
    hotelName: row.hotelName,
    hotelRef: row.hotelRef,
    createdAt: row.createdAt.toISOString(),
    plan: JSON.parse(row.plan) as HolidayPlan,
  };
}
