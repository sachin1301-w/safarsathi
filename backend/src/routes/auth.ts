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

/** Public sign-in settings for the app: the Google OAuth client id (not a secret). */
authRouter.get('/auth/config', (_req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null });
});

const googleBody = z.object({ credential: z.string().min(20) });

interface GoogleToken {
  aud: string;
  iss: string;
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  exp: string;
}

/**
 * "Continue with Google": the app sends the ID token Google gave it. Google's tokeninfo endpoint
 * checks the signature and expiry; we check it was issued for our client id and that the email
 * is verified, then log into that email's account or create one.
 */
authRouter.post('/auth/google', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new HttpError(503, "Google sign-in isn't set up on this server.");
  const { credential } = validate(googleBody, req.body);
  const check = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    { signal: AbortSignal.timeout(10_000) },
  ).catch(() => null);
  if (!check?.ok) throw new HttpError(401, 'Google sign-in failed. Please try again.');
  const token = (await check.json()) as GoogleToken;
  const issuerOk =
    token.iss === 'accounts.google.com' || token.iss === 'https://accounts.google.com';
  const verified = token.email_verified === true || token.email_verified === 'true';
  if (token.aud !== clientId || !issuerOk || !token.email || !verified)
    throw new HttpError(401, 'Google sign-in failed. Please try again.');

  const email = token.email.toLowerCase();
  const user =
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.create({
      data: { name: token.name?.trim() || email.split('@')[0], email },
    }));
  res.json({ token: await createSession(user.id), user: { id: user.id, name: user.name } });
});

authRouter.post('/auth/logout', requireAuth, async (_req, res) => {
  const token = currentToken();
  if (token) await deleteSession(token);
  res.json({ ok: true });
});
