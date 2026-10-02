/**
 * Email + password accounts with bearer-token sessions. Passwords are hashed with scrypt;
 * tokens are random and stored server-side, so logging out revokes them. Each authenticated
 * request runs inside an AsyncLocalStorage context, so services read the user with
 * currentUserId() instead of threading it through every call.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { NextFunction, Request, Response } from 'express';

import { prisma } from './db';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({ data: { token, userId } });
  return token;
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { token } });
}

const store = new AsyncLocalStorage<{ userId: string; token: string }>();

/** The signed-in user for the current request. */
export function currentUserId(): string {
  const ctx = store.getStore();
  if (!ctx) throw new Error('No signed-in user in this context');
  return ctx.userId;
}

export const currentToken = () => store.getStore()?.token;

const bearer = (req: Request) => req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];

/** Rejects requests without a valid session; otherwise runs the rest of the request as that user. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearer(req);
  const session = token
    ? await prisma.session.findUnique({ where: { token }, select: { userId: true } })
    : null;
  if (!token || !session) {
    res.status(401).json({ error: 'Please log in again.' });
    return;
  }
  store.run({ userId: session.userId, token }, next);
}
