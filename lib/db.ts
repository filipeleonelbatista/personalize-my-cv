import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __db?: PrismaClient };

export const db = g.__db ?? new PrismaClient();

if (!g.__db) g.__db = db;
