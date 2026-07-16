# Test Plan — Persistence & Save State

Manual test cases for the saved game: what survives a restart, the hydration
gate, transactional thread commits, replay, and reset. Save lives in IndexedDB
under `hyakuto-save` (key: `save`, `locale`, `completed`).

Field legend and the case-vs-run distinction: see [audio.md](audio.md).

## Shared preconditions

- App built and synced (`npx cap sync <platform>`) or `pnpm dev` for web.
- Know how to fully quit/relaunch on the device (not just background).

---

## PERS-01 — Progress survives an app restart
- area: persistence
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Complete a thread (note the ✓ and any counter changes).
  2. Fully quit and relaunch the app.
Expected: the completed thread is still marked done and counters retain their
values — the save was persisted and rehydrated.

## PERS-02 — Locale survives an app restart
- area: persistence
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Switch language (e.g. ENG → UKR), quit, relaunch.
Expected: the app reopens in the previously selected language.

## PERS-03 — Hydration gate shows splash, no flash of default state
- area: persistence
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Preconditions: a save exists (completed threads, non-default locale).
Steps:
  1. Launch and watch the very first frames.
Expected: the 百灯 splash shows until the persisted store has hydrated; the UI
does NOT briefly render default state (empty progress / English) before snapping
to the saved state.

## PERS-04 — Thread commit is idempotent
- area: persistence
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. Complete a thread that applies an effect (e.g. `candles -10`); note the value.
  2. Replay the same thread to completion.
Expected: the effect is committed exactly once. Replaying does not change the
counters again (no double-apply); `completed` does not gain a duplicate entry.

## PERS-05 — Replay strips effects
- area: persistence
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Preconditions: a completed thread with effects.
Steps:
  1. Re-open the completed thread and watch the dev console while it plays.
Expected: during replay no affinity/counter/flag effects fire — the transcript
renders but state is unchanged.

## PERS-06 — Reset clears save and completed
- area: persistence
- priority: med
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. With progress saved, trigger reset.
Expected: `save` returns to a fresh state AND `completed` is emptied; after a
relaunch the cleared state persists (the reset was written through).

## PERS-07 — IndexedDB used, and works in the browser too
- area: persistence
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. On web, complete a thread, then inspect DevTools → Application → IndexedDB.
Expected: a `hyakuto-save` store holds the state (not localStorage); persistence
works in a normal browser as well as on device.

## PERS-08 — Incomplete play persists nothing
- area: persistence
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Play a thread partway (past an effect), leave before the end, relaunch.
Expected: none of the partial play's effects are saved and the thread is not
marked complete — only a fully completed thread commits.

## PERS-09 — Guest data survives only as long as the device does
- area: persistence
- priority: low
- platforms: [ios, android, web]
- automatable: no

Steps:
  1. Build progress as a guest (no linked account), then delete & reinstall
     the app. Run once with sync disabled, once with it enabled.
Expected: a reinstall starts fresh either way, but for different reasons:
  - **Sync disabled**: expected outright — IndexedDB is the only copy that
    ever existed, and it's gone with the app.
  - **Sync enabled**: the server *does* still hold a copy, but it's addressed
    only by the guest bearer token, which was itself stored only in the
    now-deleted IndexedDB — nothing survives to prove the data is "yours."
    The save isn't lost server-side, it's just permanently unreachable. This
    is exactly the risk [account.md](account.md)'s ACCT-08 guest banner warns
    about before it happens; a guest who links an account first (ACCT-04)
    keeps their progress across a reinstall via account.md's sign-in/restore
    flow (ACCT-05) instead.
