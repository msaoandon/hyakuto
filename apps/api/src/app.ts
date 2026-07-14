import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth/routes";
import { me } from "./routes/me";
import { appOrigins } from "./env";

// The app, separate from the socket bootstrap so tests drive it in-process via
// app.request() — no ports, no flakiness. Surface: /v1/auth (public — the OAuth
// dance + token endpoints) and /v1/me (bearer-authed player data; the me router
// applies requireSession itself, so no route can be added to it unauthed).
export function createApp() {
  const app = new Hono();
  app.use("*", cors({ origin: appOrigins(), allowHeaders: ["content-type", "authorization"] }));
  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/v1/auth", auth);
  app.route("/v1/me", me);
  return app;
}
