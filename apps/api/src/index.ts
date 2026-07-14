import { serve } from "@hono/node-server";
import { createApp } from "./app";

// Local-only in Phase 3 (see DEV_PLAN — the backend-shape decision): runs beside
// the web dev server, holds the SQLite save store. First real deployment lands
// with Phase 4 (Supabase + the gating API).
const port = Number(process.env.PORT ?? 3100);
serve({ fetch: createApp().fetch, port });
console.log(`hyakuto api listening on http://localhost:${port}`);
