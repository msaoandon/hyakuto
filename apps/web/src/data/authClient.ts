import { PlayerSave, type PlayerSaveT } from "@hyakuto/player-save";
import { API, syncEnabled } from "./apiBase";

// Auth wire calls (DEV_PLAN Phase 3 — Auth.js on apps/api). Thin data-wiring
// only: no session STATE lives here — the store owns `session` and calls
// these functions, mirroring the existing saveSync.ts split. The bearer token
// itself never rides a URL (see apps/api/src/auth/routes.ts); it only ever
// appears in a request/response body or an Authorization header.

export type AuthAccount = { provider: string; displayName: string | null; email: string | null };
export type ExchangeResult = { token: string; account: AuthAccount; hasServerSave: boolean };

/** The two OAuth providers offered in the UI. Apple is deferred (Phase 3 plan —
 *  needs the paid Apple Developer account). */
export const PROVIDERS = ["google", "discord"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** Mint a fresh guest session (a player with no linked account). Every request
 *  to the API is bearer-authenticated the same way — there is no separate
 *  unauthenticated path. */
export async function mintGuestSession(): Promise<string> {
  if (!API) throw new Error("mintGuestSession called with sync disabled");
  const res = await fetch(`${API}/v1/auth/guest`, { method: "POST" });
  if (!res.ok) throw new Error(`guest session failed: ${res.status}`);
  return ((await res.json()) as { token: string }).token;
}

/** Navigate the browser into the OAuth dance. `returnPath` is same-origin
 *  (e.g. "/auth/return"); the API validates the full return URL against its
 *  own app-origin allow-list before it ever redirects anywhere. */
export function startSignIn(provider: Provider, returnPath: string): void {
  if (!API) throw new Error("startSignIn called with sync disabled");
  const returnTo = `${window.location.origin}${returnPath}`;
  window.location.assign(`${API}/v1/auth/start/${provider}?return=${encodeURIComponent(returnTo)}`);
}

/** Trade the one-time code from /auth/return for a bearer token. Sends the
 *  current guest token (if any) so the API can adopt its saves onto the
 *  account (see apps/api/src/auth/routes.ts POST /token) — the local save is
 *  never touched here either way. */
export async function exchangeCode(code: string, guestToken: string | null): Promise<ExchangeResult> {
  if (!API) throw new Error("exchangeCode called with sync disabled");
  const res = await fetch(`${API}/v1/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, ...(guestToken ? { guestToken } : {}) }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `token exchange failed: ${res.status}`);
  return res.json();
}

/** Pull the player's own slot-0 save straight from the server — used only
 *  right after sign-in, when the device had nothing local to lose (see
 *  gameStore.restoreFromServer and /auth/return's `wasFresh` check).
 *  Re-validated client-side with the same contract schema the API validates
 *  server-side: this now drives a live hydration of local state, a real
 *  trust boundary even though the bytes nominally came from our own API. */
export async function fetchServerSlot(token: string): Promise<PlayerSaveT> {
  if (!API) throw new Error("fetchServerSlot called with sync disabled");
  const res = await fetch(`${API}/v1/me/slots/0`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`fetch server slot failed: ${res.status}`);
  return PlayerSave.parse(await res.json());
}

/** Revoke a session server-side (sign-out). Best-effort — the caller clears
 *  local state regardless of whether this succeeds. */
export async function revokeSession(token: string): Promise<void> {
  if (!API) return;
  await fetch(`${API}/v1/auth/session`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } }).catch(
    (err) => console.warn("sign-out (server) failed — local session cleared anyway:", err),
  );
}

/** GDPR account deletion: destroys the player row server-side (saves, linked
 *  accounts, sessions — everything, via cascade). Unlike revokeSession this is
 *  NOT best-effort: the caller must only wipe local state once this resolves,
 *  otherwise "deleted" is a lie the server doesn't back up. */
export async function deleteAccount(token: string): Promise<void> {
  if (!API) throw new Error("deleteAccount called with sync disabled");
  const res = await fetch(`${API}/v1/me`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`account deletion failed: ${res.status}`);
}

export { syncEnabled };
