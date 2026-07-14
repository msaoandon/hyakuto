import { prisma } from "../db";
import { newToken, sha256, SESSION_TTL_MS, SESSION_TOUCH_INTERVAL_MS } from "./tokens";

// ApiSession lifecycle. One model for everyone: a guest is a player with no
// linked AuthAccount, not a separate (weaker) auth path — every request to the
// API is bearer-authenticated the same way.

/** Mint a session for a player; returns the plaintext token (its only existence). */
export async function mintSession(playerId: string): Promise<string> {
  const token = newToken();
  await prisma.apiSession.create({
    data: {
      tokenHash: sha256(token),
      playerId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

/** Resolve a bearer token to a playerId, sliding the expiry (throttled).
 *  Expired sessions are deleted on sight and resolve to null. */
export async function resolveSession(token: string): Promise<string | null> {
  const tokenHash = sha256(token);
  const session = await prisma.apiSession.findUnique({ where: { tokenHash } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.apiSession.delete({ where: { tokenHash } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastUsedAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await prisma.apiSession.update({
      where: { tokenHash },
      data: { lastUsedAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) },
    });
  }
  return session.playerId;
}

/** Revoke one session (sign-out). Idempotent. */
export async function revokeSession(token: string): Promise<void> {
  await prisma.apiSession.deleteMany({ where: { tokenHash: sha256(token) } });
}
