import 'dotenv/config';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';

import { healthRouter } from './routes/health';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', healthRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
// Bind to all interfaces so a phone on the same Wi-Fi can reach the laptop.
app.listen(port, '0.0.0.0', () => {
  console.log(`SafarSathi backend listening on http://0.0.0.0:${port}`);
});
