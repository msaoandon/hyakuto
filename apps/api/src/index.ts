import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";

// Local-only in Phase 3 (see DEV_PLAN — the backend-shape decision): runs beside
// the web dev server, holds the SQLite save store. First real deployment lands
// with Phase 4 (Supabase + the gating API).
//
// Prisma loads .env for DATABASE_URL by itself; the auth variables (AUTH_SECRET,
// provider credentials) need it loaded into the process too — before ./app pulls
// in the auth config.
if (existsSync(".env")) process.loadEnvFile(".env");

const { createApp } = await import("./app");

const port = Number(process.env.PORT ?? 3100);
serve({ fetch: createApp().fetch, port });
console.log(`hyakuto api listening on http://localhost:${port}`);
