import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** The seeded demo account (log in as demo@safarsathi.app / demo1234). */
export const DEMO_USER_ID = 'demo-user';
