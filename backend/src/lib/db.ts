import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** The single seeded demo user (no auth in the hackathon build). */
export const DEMO_USER_ID = 'demo-user';
