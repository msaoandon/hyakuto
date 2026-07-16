# Test Plan — Account & Saved Games

Manual test cases for the `apps/api`-backed features (DEV_PLAN Phase 3): the
`/login` front door, guest sessions, Google/Discord sign-in, guest→account
adoption, account deletion (GDPR), the Lobby guest-sync banner, and the
Saved Games multi-slot UI. Everything here is **opt-in** — with
`NEXT_PUBLIC_API_URL` unset, none of it exists and `apps/web` plays fully
offline against IndexedDB (see [persistence.md](persistence.md) instead).

Field legend and the case-vs-run distinction: see [audio.md](audio.md).

## Shared preconditions

- `apps/api` running (`pnpm --filter @hyakuto/api dev`, port 3100) with a
  clean or known `.data/dev.db`.
- `apps/web` run with `NEXT_PUBLIC_API_URL=http://localhost:3100` (or
  `apps/web/.env.local`).
- For real-provider cases: `AUTH_GOOGLE_ID`/`SECRET` and/or
  `AUTH_DISCORD_ID`/`SECRET` configured in `apps/api/.env`. Without them,
  those two providers 400 with "not configured" (see ACCT-11) — expected, not
  a bug.
- **Platforms:** these cases are `web`-only today — the API is local-only
  (DEV_PLAN Phase 3 decision, not yet deployed), so a native build can't
  reach it without a device-reachable host. Re-scope to `[ios, android]` once
  Phase 4 deploys the service.

---

## Account & Auth

### ACCT-01 — A fresh sync-enabled profile routes through /login before /welcome
- area: account
- priority: high
- platforms: [web]
- automatable: partial   # routing is Playwright-able; the OAuth hop itself needs a real/mock provider

Preconditions: fresh profile (cleared IndexedDB), sync enabled.
Steps:
  1. Launch the app and tap "Touch to Start".
Expected: lands on `/login` (Sign in with Google/Discord, "Continue as
guest") — not `/welcome`. An existing install (persisted before this
feature) is never sent here (`authChoiceMade` migration defaults to `true`).

### ACCT-02 — Continue as guest skips OAuth entirely
- area: account
- priority: high
- platforms: [web]
- automatable: yes

Steps:
  1. On `/login`, tap "Continue as guest".
Expected: no network request fires for this tap; lands on `/welcome` (fresh
profile) or `/lobby` (already has a chosen MC). `authChoiceMade` is now true
so `/login` is never shown again on this device.

### ACCT-03 — Guest session is minted once and reused
- area: account
- priority: med
- platforms: [web]
- automatable: partial

Steps:
  1. As a guest, trigger the first sync event (e.g. complete a thread).
  2. Reload the app and trigger another sync event.
Expected: exactly one `POST /v1/auth/guest` call across both steps — the
minted token is persisted and reused, not re-minted on reload.

### ACCT-04 — Sign in with a real provider establishes a session
- area: account
- priority: high
- platforms: [web]
- automatable: no   # walks a real Google/Discord consent screen

Preconditions: the provider is configured with real credentials.
Steps:
  1. From `/login` or Settings, tap "Continue with {provider}" / "Link with
     {provider}" and complete the provider's consent screen.
Expected: redirected back into the app, landing on `/lobby` or `/welcome`;
Settings → Account now shows "Signed in with {provider}" and a Sign out
control. The bearer token never appears in the URL at any point in the
redirect chain (only a short-lived one-time `code`).

### ACCT-05 — First sign-in on a provably-fresh device auto-restores
- area: account
- priority: high
- platforms: [web]
- automatable: partial   # exercised in oauth-dance.test.ts server-side; the client hop needs a browser

Preconditions: an account that already has a server save (candles ≠ 100,
`mcChosen: true`); a brand-new local profile (nothing played yet).
Steps:
  1. From `/login`, sign in with that account.
Expected: no restore notice — the server save is pulled and hydrated
automatically in one replace (`restoreFromServer`), landing on `/lobby`
already showing the account's candles/progress.

### ACCT-06 — Sign-in with conflicting local + server progress shows a notice only
- area: account
- priority: med
- platforms: [web]
- automatable: partial

Preconditions: play a few minutes as a guest first (so local progress
exists), *then* link an account (Settings → Link with {provider}) whose
server save differs from local.
Steps:
  1. Complete the link flow.
Expected: `account.restoreNotice` copy appears ("a save from this account was
found... restoring it isn't supported yet"); local progress is left exactly
as it was — nothing is silently merged or overwritten either direction. This
is the documented remaining Phase-3 gap, not a bug to "fix" by asserting a
specific resolution.

### ACCT-07 — Sign out drops the session, play continues as guest
- area: account
- priority: med
- platforms: [web]
- automatable: yes

Steps:
  1. Signed in, go to Settings → Account → Sign out.
  2. Trigger a sync event (e.g. complete a thread).
Expected: Settings reverts to the signed-out ("Link your account") framing;
the next sync event mints a fresh guest session — local save is untouched,
`authChoiceMade` stays true (no re-prompt to `/login`).

### ACCT-08 — Guest banner visibility tracks account state
- area: account
- priority: med
- platforms: [web]
- automatable: yes

Steps:
  1. As a guest (no linked account), open the Lobby.
  2. Link an account, return to the Lobby.
  3. Restart with sync disabled (no `NEXT_PUBLIC_API_URL`), open the Lobby.
Expected: (1) banner visible ("Playing as a guest… tap to link an
account"), tapping it opens Settings; (2) banner gone once an account is
linked; (3) banner never renders when sync is off, regardless of state.

### ACCT-09 — Account deletion erases everything, locally and on the server
- area: account
- priority: high
- platforms: [web]
- automatable: partial   # the DELETE /v1/me cascade is unit-tested server-side; this is the UI wiring

Preconditions: signed in, with at least one save slot on the server.
Steps:
  1. Settings → Account → "Delete my account" → confirm ("Erase everything").
  2. Reload the app.
Expected: local save/identity/avatar/session are wiped and `authChoiceMade`
is false — the device looks genuinely fresh, routing through `/login` again.
A direct API check (`GET /v1/me` with the old token) 401s — the account,
its saves, and all linked-provider rows are actually gone server-side, not
just hidden client-side.

### ACCT-10 — A failed account deletion changes nothing
- area: account
- priority: med
- platforms: [web]
- automatable: partial   # needs a way to force the DELETE to fail (offline, or a mocked 500)

Preconditions: signed in; simulate a failed `DELETE /v1/me` (e.g. stop
`apps/api` mid-request, or intercept the request to return 500).
Steps:
  1. Settings → Account → "Delete my account" → confirm.
Expected: an error message appears ("Deletion didn't go through — nothing
was erased"); the account, session, and local save are all exactly as
before — deletion never partially applies.

### ACCT-11 — An unconfigured provider fails clearly, not with a broken redirect
- area: account
- priority: low
- platforms: [web]
- automatable: yes   # server-side asserted in apps/api's auth.test.ts

Preconditions: a provider (e.g. Discord) has no credentials in `apps/api/.env`.
Steps:
  1. Tap "Continue with Discord" / "Link with Discord".
Expected: the request to `/v1/auth/start/discord` returns 400 "not
configured" — no redirect to a broken provider URL, no unhandled exception
in the UI.

---

## Saved Games (multi-slot)

### SAVE-01 — Saved Games requires an account
- area: save-load
- priority: high
- platforms: [web]
- automatable: yes

Steps:
  1. As a guest (no linked account), open Lobby → Load.
Expected: a sign-in prompt ("Sign in to save your progress to an account…")
with a link to Settings — no slot list, no error. Signed in, the same route
shows the real list instead.

### SAVE-02 — Slot list shows accurate metadata
- area: save-load
- priority: high
- platforms: [web]
- automatable: partial   # list endpoint is unit-tested; this is the UI rendering of it

Preconditions: signed in, with 2+ save slots on the server holding different
candle counts / completed-thread counts.
Steps:
  1. Open Saved Games.
Expected: every server slot appears, each showing its own candle count,
"N chats completed", and a last-updated timestamp matching the server data
(cross-check via `GET /v1/me/slots`).

### SAVE-03 — The active slot is marked and can't be played or deleted from itself
- area: save-load
- priority: med
- platforms: [web]
- automatable: yes

Steps:
  1. Open Saved Games while playing slot 0.
Expected: slot 0's row shows "Currently playing" and has neither a Play nor
a Delete control — those actions only exist on the other rows.

### SAVE-04 — Switching slots fully replaces local state
- area: save-load
- priority: high
- platforms: [web]
- automatable: partial

Preconditions: two slots with different candles/MC name/completed threads.
Steps:
  1. From Saved Games, tap Play on the non-active slot, confirm ("Switch").
Expected: redirected into the game (`/lobby` or `/welcome` depending on that
slot's `mcChosen`); candles, MC identity, and completed threads all now
match the *target* slot, not the one just left. Returning to Saved Games
shows the new slot marked "Currently playing".

### SAVE-05 — Starting a new save begins a fresh, separate playthrough
- area: save-load
- priority: high
- platforms: [web]
- automatable: partial

Preconditions: at least one existing slot with real progress.
Steps:
  1. From Saved Games, tap "+ New save".
Expected: routes to `/welcome` (the MC picker, unanswered); candles reset to
the fresh-game default; the previous slot's data is untouched — confirm via
`GET /v1/me/slots/<old slot>` still returning the old values after this step.

### SAVE-06 — Deleting a slot removes it from the server, not just the list
- area: save-load
- priority: high
- platforms: [web]
- automatable: partial   # server delete is unit-tested; this is the UI + real round-trip

Preconditions: a non-active slot with a save already pushed to the server.
Steps:
  1. From Saved Games, tap Delete on that slot, confirm ("Erase this save").
  2. Directly query `GET /v1/me/slots/<that slot>`.
Expected: the row disappears from the UI immediately; the direct query 404s
— genuinely deleted server-side, not just filtered from the local list.

### SAVE-07 — The MC avatar switches with the slot
- area: save-load
- priority: low
- platforms: [web]
- automatable: no   # visual check

Preconditions: two slots, each with a different avatar photo set (or one
with a photo and one without).
Steps:
  1. Switch between the two slots via Saved Games.
Expected: the Lobby/Settings avatar changes to match whichever slot is
active — never shows the other slot's photo, never shows a stale photo after
switching to a slot with none.

### SAVE-08 — A brand-new account shows an empty state, not an error
- area: save-load
- priority: low
- platforms: [web]
- automatable: yes

Preconditions: an account that has never synced anything (no save slots on
the server yet).
Steps:
  1. Open Saved Games.
Expected: "No saves on the server yet — your current progress syncs
automatically as you play" — not a spinner stuck forever, not an error banner.

### SAVE-09 — A failed list/switch/delete surfaces an error, doesn't corrupt state
- area: save-load
- priority: med
- platforms: [web]
- automatable: partial   # needs a way to force a failure (stop apps/api, or intercept the request)

Steps:
  1. Stop `apps/api` (or intercept the request to fail), then open Saved
     Games / attempt to switch or delete a slot.
Expected: a visible error message per action ("Couldn't load your
saves"/"Couldn't load that save"/deletion error) — the slot list, current
slot, and local save are left exactly as they were before the failed action.

---

## Recording a run

See [audio.md](audio.md#recording-a-run) for the dated-table format and
status legend.
