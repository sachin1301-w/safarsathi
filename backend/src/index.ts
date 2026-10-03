import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import { describeAdapters } from './adapters';
import { errorHandler } from './lib/http';
import { requireAuth } from './lib/auth';
import { prisma } from './lib/db';
import { alertsRouter } from './routes/alerts';
import { authRouter } from './routes/auth';
import { bookingsRouter } from './routes/bookings';
import { chargersRouter } from './routes/chargers';
import { chatRouter } from './routes/chat';
import { healthRouter } from './routes/health';
import { journeysRouter } from './routes/journeys';
import { parkingRouter } from './routes/parking';
import { profileRouter } from './routes/profile';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // voice clips arrive as base64

// Open routes, then everything else needs a logged-in user.
app.use('/api', healthRouter, authRouter);
app.use(
  '/api',
  requireAuth,
  profileRouter,
  chargersRouter,
  parkingRouter,
  journeysRouter,
  bookingsRouter,
  alertsRouter,
  chatRouter,
);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use(errorHandler);

async function warmUpDatabase(attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await prisma.user.count();
      console.log('Database connected');
      return;
    } catch (err) {
      if (i === attempts)
        console.error('Database connection failed:', (err as Error).message.trim());
    }
  }
}

const port = Number(process.env.PORT ?? 4000);
// Bind to all interfaces so a phone on the same Wi-Fi can reach the laptop.
app.listen(port, '0.0.0.0', () => {
  console.log(`SafarSathi backend listening on http://0.0.0.0:${port}`);
  console.log('Adapters:', describeAdapters());
  // Open the database connection now, so users never hit the first query's slow TLS handshake to
  // MongoDB Atlas (on this laptop AVG's scanning makes that first one time out). Retries until up.
  void warmUpDatabase();
});
