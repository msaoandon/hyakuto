import { Hono } from "hono";
import { cors } from "hono/cors";
import { slots } from "./routes/slots";

// The app, separate from the socket bootstrap so tests drive it in-process via
// app.request() — no ports, no flakiness.
export function createApp() {
  const app = new Hono();
  app.use("*", cors({ origin: ["http://localhost:3000"] })); // the web dev server only
  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/v1", slots);
  return app;
}
