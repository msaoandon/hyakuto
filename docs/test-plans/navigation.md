# Test Plan — Navigation (Splash · Lobby · Story)

Manual test cases for the app shell: the splash/entry, the persistent Lobby, the
Story hub, the current-day Chat list with its Timeline modal, participant
profiles, and the back/exit chains. Covers the move off the old `/play` flow.

Field legend (id / area / priority / platforms / automatable) and the
case-vs-run distinction are documented in [audio.md](audio.md).

## Shared preconditions

- App built and synced: `cd apps/web && pnpm build && npx cap sync <platform>` (or `pnpm dev` for web).
- The demo content (days 1–2, one VN unit on day 1).
- A way to reach known progress states (play chats to completion / dev console).

---

## NAV-01 — Splash holds while loading, then invites a tap
- area: navigation
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Cold-launch the app.
Expected: the `百灯` splash shows while the save hydrates (no flash of empty/UI
before the store is ready); once ready, the title screen shows "Touch to Start".

## NAV-02 — Touch to Start enters the Lobby and unlocks audio
- area: navigation
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. From the title screen, tap anywhere.
Expected: navigates to the Lobby. This first gesture also unlocks audio (music
can begin per the audio plan) — there is no separate "start audio" tap.

## NAV-03 — Language chooser on the title screen does not start the game
- area: navigation
- priority: med
- platforms: [ios, android, web]
- automatable: no

Steps:
  1. On the title screen, tap the language chooser (top-right) and switch locale.
Expected: the locale changes in place; tapping the chooser does **not** navigate
to the Lobby. Tapping elsewhere on the screen still does.

## NAV-04 — Lobby tiles route correctly; History is disabled
- area: navigation
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. In the Lobby, tap each tile: Library, Album, Load, Settings.
  2. Try History.
Expected: Story opens the Story hub; Library/Album/Settings open their screens;
Load opens Saved Games; History is visibly disabled (dimmed, not tappable).

## NAV-05 — Story hub header shows the derived current day + candles
- area: navigation
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. Open Story with no progress, then again after completing day 1's chats.
Expected: the header reads `Day N · 🕯<count>` where N is the **current day**
(first incomplete day) and the count is the live candle counter. With no
progress it reads Day 1; after day 1 is complete it reads Day 2.

## NAV-06 — Hub avatar row opens participant profiles
- area: navigation
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. On the Story hub, tap a participant avatar.
Expected: navigates to that participant's profile (own screen, URL
`/story/participants/<id>`) showing avatar + name. Back returns to the hub.

## NAV-07 — DMs entry is present but disabled (Phase B)
- area: navigation
- priority: low
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. On the Story hub, try the DMs button.
Expected: DMs is visibly disabled (dimmed, not tappable). Chat is the only
active door besides the avatars.

## NAV-08 — Chat opens the current day directly
- area: navigation
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. From the hub, tap Chat.
Expected: opens `/story/chat/<currentDay>` — the current day's chat list, not a
"choose a day" screen (that screen no longer exists).

## NAV-09 — Chat list markers: done / open / locked
- area: navigation
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. On the current day's chat list, observe each entry.
Expected: completed chats show `✓` and are dimmed; unlocked chats are plain and
tappable; locked chats show `🔒` and are not tappable. VN units are marked `📖`.

## NAV-10 — Timeline modal classifies past / current / future
- area: navigation
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Preconditions: day 1 complete, day 2 current (demo).
Steps:
  1. On the chat list, tap the Timeline button (▦).
Expected: a modal lists all days — past days marked `✓` (rereadable), the current
day marked `▸` (highlighted), future days marked `🔒` (not tappable).

## NAV-11 — Timeline navigates to a past day; future is not reachable
- area: navigation
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. In the Timeline, tap a past day, then reopen and try a future day.
Expected: tapping a past (or current) day opens that day's chat list and closes
the modal; a future day does nothing (locked). The Timeline is the **only** way
to reach another day.

## NAV-12 — Current day auto-advances when the day's chain completes
- area: navigation
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. With day 1 current, complete all of day 1's chats.
  2. Return to the hub / open Chat.
Expected: the current day becomes day 2 with no explicit "advance" action —
Chat now lands on day 2, and the Timeline marks day 1 as past `✓`.

## NAV-13 — Back / home chain is consistent
- area: navigation
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Walk Lobby → Story → Chat (day) → a chat, then back out with the headers.
Expected: a chat's back → its day's chat list; the chat list's back → Story hub;
the hub's `☰` → Lobby. No step lands on a dead or `/play` URL.

## NAV-14 — Players live under Chat; exit returns to the day
- area: navigation
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Open a chat thread and a VN unit from the current day; finish each and tap Exit.
Expected: both play under `/story/chat/<day>/…` (chat at `…/<thread>`, VN at
`…/vn/<id>`); Exit returns to that day's chat list. Music/scene cues still fire
(the audio route detection follows the new paths).

## NAV-15 — Lobby is reachable any time
- area: navigation
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. From deep in the Story (a chat list / hub), use the `☰` affordance.
Expected: returns to the Lobby without losing progress; re-entering Story lands
on the correct current day.

## NAV-16 — No legacy `/play` route resolves
- area: navigation
- priority: med
- platforms: [web]
- automatable: yes

Steps:
  1. Navigate directly to `/play`, `/play/day/1`, `/play/day/1/day1_01`.
Expected: none resolve to a real screen (the routes were removed); the app does
not crash. All in-app links point at `/story/...`.

## NAV-17 — Deep-link / refresh on a Story route restores correctly
- area: navigation
- priority: med
- platforms: [web]
- automatable: partial

Steps:
  1. On `/story/chat/2` (or a participant profile), refresh the page.
Expected: after the splash/hydration gate, the same screen renders with correct
state (the static route exists and the store rehydrates). No redirect loop.

## NAV-18 — All days complete: current day clamps to the last
- area: navigation
- priority: low
- platforms: [ios, android, web]
- automatable: yes

Preconditions: every day's chats completed.
Steps:
  1. Open Story / Chat.
Expected: the current day is the **last** day (it does not advance past the end);
the Timeline shows every prior day as past `✓` and the last as current `▸`.
