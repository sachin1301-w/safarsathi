import { Router } from 'express';
import { z } from 'zod';

import {
  createSession,
  currentToken,
  deleteSession,
  hashPassword,
  requireAuth,
  verifyPassword,
} from '../lib/auth';
import { prisma } from '../lib/db';
import { HttpError, validate } from '../lib/http';
import { LANGUAGE_CODES } from '../lib/languages';

export const authRouter = Router();

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const password = z.string().min(6, 'Password must be at least 6 characters').max(128);

const signupBody = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(60),
  email,
  password,
  language: z.enum(LANGUAGE_CODES).optional(),
});

authRouter.post('/auth/signup', async (req, res) => {
  const body = validate(signupBody, req.body);
  if (await prisma.user.findUnique({ where: { email: body.email } }))
    throw new HttpError(409, 'An account with this email already exists. Log in instead.');
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      language: body.language ?? 'en-IN',
    },
  });
  res
    .status(201)
    .json({ token: await createSession(user.id), user: { id: user.id, name: user.name } });
});

const loginBody = z.object({ email, password: z.string().min(1, 'Enter your password') });

authRouter.post('/auth/login', async (req, res) => {
  const body = validate(loginBody, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash)))
    throw new HttpError(401, 'Wrong email or password.');
  res.json({ token: await createSession(user.id), user: { id: user.id, name: user.name } });
});

authRouter.post('/auth/logout', requireAuth, async (_req, res) => {
  const token = currentToken();
  if (token) await deleteSession(token);
  res.json({ ok: true });
});
