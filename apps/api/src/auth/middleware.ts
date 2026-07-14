import { createMiddleware } from "hono/factory";
import { resolveSession } from "./sessions";

// Bearer auth for everything under /v1/me. There is deliberately NO
// unauthenticated data path: identity is always a server-issued token
// (guest or account), so "write to someone else's player" is not a case
// to check for — it is unrepresentable in the routes.

export type AuthedEnv = { Variables: { playerId: string } };

export const requireSession = createMiddleware<AuthedEnv>(async (c, next) => {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return c.json({ error: "missing bearer token" }, 401);
  const playerId = await resolveSession(token);
  if (!playerId) return c.json({ error: "invalid or expired token" }, 401);
  c.set("playerId", playerId);
  await next();
});
