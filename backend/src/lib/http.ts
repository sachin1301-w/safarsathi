import type { ErrorRequestHandler } from 'express';
import { z, ZodError, type ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);

/** Parses input with a Zod schema; a failure becomes a 400 with a readable message. */
export function validate<T>(schema: ZodType<T>, input: unknown): T {
  return schema.parse(input);
}

/** Query-string number, e.g. `?radiusKm=5`. */
export const queryNumber = () => z.coerce.number().finite();

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
      .join('; ');
    res.status(400).json({ error: message });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
