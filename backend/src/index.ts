import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import { describeAdapters } from './adapters';
import { errorHandler } from './lib/http';
import { chargersRouter } from './routes/chargers';
import { healthRouter } from './routes/health';
import { journeysRouter } from './routes/journeys';
import { parkingRouter } from './routes/parking';
import { profileRouter } from './routes/profile';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // voice clips arrive as base64

app.use('/api', healthRouter, profileRouter, chargersRouter, parkingRouter, journeysRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
// Bind to all interfaces so a phone on the same Wi-Fi can reach the laptop.
app.listen(port, '0.0.0.0', () => {
  console.log(`SafarSathi backend listening on http://0.0.0.0:${port}`);
  console.log('Adapters:', describeAdapters());
});
