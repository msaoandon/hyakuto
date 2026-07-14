import { createHash, randomBytes } from "node:crypto";

// Bearer-token primitives. Tokens and login codes are random 256-bit values;
// only their SHA-256 ever touches the database (a leaked DB must not be a
// skeleton key). SHA-256 without salt is correct here — the input is a full-
// entropy random value, not a password, so rainbow/dictionary attacks don't apply.

export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // sliding, re-armed on use
/** Touching lastUsedAt on EVERY request is a pointless write amplifier; slide
 *  the expiry only when the last touch is older than this. */
export const SESSION_TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const LOGIN_CODE_TTL_MS = 60 * 1000; // one redirect + one fetch, nothing more

/** `hyk_` prefix makes a leaked token recognizable in logs/scanners (the same
 *  reason GitHub prefixes theirs). */
export function newToken(): string {
  return `hyk_${randomBytes(32).toString("base64url")}`;
}

export function newLoginCode(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
