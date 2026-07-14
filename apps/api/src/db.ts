import { PrismaClient } from "@prisma/client";

// One client per process. DATABASE_URL comes from .env (dev) or the vitest env
// (tests) — a gitignored SQLite file either way; Supabase swaps the datasource
// in Phase 4 against this same schema.
export const prisma = new PrismaClient();
