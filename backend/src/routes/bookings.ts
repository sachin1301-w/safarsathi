import { Router } from 'express';
import { z } from 'zod';

import { HttpError, validate } from '../lib/http';
import { bookAll, BookingError, bookLeg, listTrips } from '../services/bookings';

export const bookingsRouter = Router();

const asHttp = (err: unknown) =>
  err instanceof BookingError ? new HttpError(err.status, err.message) : err;

const bookingBody = z.object({ tripId: z.string().min(1), legId: z.string().min(1) });

bookingsRouter.post('/bookings', async (req, res) => {
  const { tripId, legId } = validate(bookingBody, req.body);
  try {
    const { bookingRef } = await bookLeg(tripId, legId);
    res.status(201).json({ bookingRef });
  } catch (err) {
    throw asHttp(err);
  }
});

/** "Book all": every bookable leg of the trip in one go. */
bookingsRouter.post('/trips/:id/book-all', async (req, res) => {
  try {
    res.json(await bookAll(req.params.id));
  } catch (err) {
    throw asHttp(err);
  }
});

bookingsRouter.get('/trips', async (_req, res) => {
  res.json(await listTrips());
});
