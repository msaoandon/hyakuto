# Test Plan — DM Mode (Messages Inbox)

Manual test cases for direct messages: the Messages inbox off the Story hub,
cross-day 1:1 conversations, relationship gating (not the chat wall-clock model),
and the shared chat player. DMs render like a chat but never appear in the day
chat list.

Field legend (id / area / priority / platforms / automatable) and the
case-vs-run distinction are documented in [audio.md](audio.md).

## Shared preconditions

- App built and synced: `cd apps/web && pnpm build && npx cap sync <platform>` (or `pnpm dev` for web).
- The demo content: DM `dm_1` (Ren) — an opener `dm_1a` gated on completing the
  day-1 Oiwa chat (`completed:1:day1_01`), and a continuation `dm_1b` gated on the
  day-2 Okiku chat (`completed:2:day2_01`) so it arrives later as a new message.
- A way to reach known progress (play chats / dev console).

---

## DM-01 — DMs are reachable from the Story hub, not the day list
- area: dm
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Open Story → Chat (a day's chat list).
  2. Open Story → DMs.
Expected: no DM appears in the day's chat list; the DMs door on the hub opens the
Messages inbox (`/story/dms`). The two surfaces are separate.

## DM-02 — A locked DM is absent until its gate passes
- area: dm
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Preconditions: the gating chat (day-1 `day1_01`) NOT completed.
Steps:
  1. Open the Messages inbox.
Expected: the inbox is empty (shows the "No messages yet." state); Ren is not
listed — the conversation hasn't started.

## DM-03 — Completing the gating chat surfaces the DM
- area: dm
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. Play the day-1 Oiwa chat (`day1_01`) to completion.
  2. Open the Messages inbox.
Expected: Ren now appears in the inbox with their avatar and name — the contact
has "messaged" you. (The DM surfaces on its first segment's condition.)

## DM-04 — Opening a DM plays it as a 1:1 chat
- area: dm
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Tap Ren in the inbox.
Expected: opens a chat-style conversation (`/story/dms/dm_1`) with the contact's
name in the header; messages stream, typing indicators show, and MC choices work
exactly as in a group chat.

## DM-05 — A DM is one conversation across days
- area: dm
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Preconditions: the gate passed (so both the day-1 and day-2 segments are unlocked).
Steps:
  1. Play the Ren DM to the end.
Expected: the day-1 opener and the day-2 continuation play as a single,
continuous conversation in day order — not two separate threads. (Engine
`assembleDM` concatenates unlocked segments across all days.)

## DM-06 — DM choices apply effects
- area: dm
- priority: med
- platforms: [ios, android, web]
- automatable: yes

Preconditions: a DM choice carrying an effect (the demo's "Just thinking." raises
`patience`).
Steps:
  1. Pick the effect-bearing option.
Expected: the affinity/counter updates (visible via dev console), matching the
authored delta.

## DM-07 — Exit returns to the inbox
- area: dm
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Finish the DM and tap Exit (and separately, use the header back).
Expected: both return to the Messages inbox (`/story/dms`), not a day chat list.
The completed DM shows a ✓.

## DM-08 — Music resolves in a DM like a chat
- area: dm
- priority: med
- platforms: [ios, android]
- automatable: no

Preconditions: audio unlocked; the DM thread has an `ost` (demo: `chat_night`).
Steps:
  1. Open the Ren DM and listen.
Expected: the DM's OST plays (cue ▸ thread `ost` ▸ default) — the `/story/dms`
route resolves music, it is not stuck on app-ambient.

## DM-09 — Replaying a caught-up DM is read-only
- area: dm
- priority: med
- platforms: [ios, android, web]
- automatable: yes

Preconditions: the Ren DM fully read (no unread).
Steps:
  1. Re-open it from the inbox.
Expected: the conversation re-shows as a read-back — effects do not re-apply (no
double-counting) and choices are not prompted. (See DM-18 for the no-prompt UX.)

## DM-10 — Interrupted DM is not completed
- area: dm
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Open the DM, play partway, leave before the end.
  2. Re-open it.
Expected: the DM is not marked ✓ and restarts from the beginning; no effects from
the partial play persist.

## DM-11 — A DM is not a day chat (no day list entry, no chat route)
- area: dm
- priority: med
- platforms: [web]
- automatable: yes

Steps:
  1. Inspect each day's chat list for the DM's `thread_id`.
  2. Navigate directly to `/story/chat/1/dm_1`.
Expected: the DM never lists in a day; the chat route is not generated for a `dm`
thread (it lives only at `/story/dms/<thread>`).

## DM-12 — Authoring guard: a DM with wall-clock unlock fails CI
- area: dm
- priority: med
- platforms: [web]
- automatable: yes

Preconditions: a `_threads` DM row with an `unlock_after` value.
Steps:
  1. Run content validation (`pnpm --filter @hyakuto/content validate <dir>`).
Expected: validation errors — DMs gate by `condition`, not the wall-clock
`unlock_after`. (Also: a thread mixing `dm` and non-`dm` segments fails the
homogeneous-type check.)

## DM-13 — Unread badge appears when a DM has new messages
- area: dm
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. Complete the day-1 Oiwa chat.
  2. Look at the Story hub's DMs door and the inbox.
Expected: the DMs door shows a total-unread badge and the inbox shows a per-DM
unread count (Ren = 1) — the opener `dm_1a` is unread.

## DM-14 — Reading a DM clears its unread badge
- area: dm
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Preconditions: Ren shows unread.
Steps:
  1. Open Ren and play to the end.
  2. Return to the inbox / hub.
Expected: after completion the unread count clears — the inbox shows ✓, the hub
badge drops. (Read state is marked on completion, not merely on open.)

## DM-15 — A later-gated segment arrives as a new message
- area: dm
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Preconditions: `dm_1a` already read (DM caught up, ✓).
Steps:
  1. Complete the day-2 Okiku chat (`day2_01`).
  2. Open the inbox.
Expected: Ren shows an unread badge again (1) — only the newly-unlocked `dm_1b`
counts as unread; the already-read opener does not.

## DM-16 — Re-entry plays only the new messages (no replay, no re-prompt)
- area: dm
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Preconditions: `dm_1a` read; `dm_1b` now unread (DM-15).
Steps:
  1. Open Ren.
Expected: only the new `dm_1b` line(s) play — the day-1 opener does NOT replay,
and the day-1 choice is NOT prompted again. (Regression guard: re-entry used to
rebuild the whole conversation and re-prompt the answered choice.)

## DM-17 — New-message effects apply once; read history doesn't double-count
- area: dm
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. Note affinity/counters, then read a DM whose new segment carries an effect.
  2. Re-open the DM after it's caught up.
Expected: the new segment's effect applies exactly once (the first read);
re-opening a caught-up DM applies no effects (the read-back is non-interactive).

## DM-18 — Caught-up DM shows a read-back, not a re-prompt
- area: dm
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Preconditions: Ren fully read (no unread).
Steps:
  1. Open Ren again.
Expected: the conversation shows as a read-back (messages only) — no choice
prompt appears and no Reply is required; reaching the end offers Exit.

## DM-19 — Read state survives a restart
- area: dm
- priority: med
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. Read a DM, close/reopen the app.
Expected: the DM stays marked read (no phantom unread badge) — the read cursor
persists with the save.
