# Test Plan — VN Mode (Visual-Novel Reader)

Manual test cases for VN segments: the step-through reader, scene backgrounds,
narrator/speech styling, the Skip/Next/Auto controls, the MC chooser overlay, and
the navigation/gating edges that differ from chat.

Field legend (id / area / priority / platforms / automatable) and the
case-vs-run distinction are documented in [audio.md](audio.md).

## Shared preconditions

- App built and synced: `cd apps/web && pnpm build && npx cap sync <platform>` (or `pnpm dev` for web).
- A day containing a `vn` unit (the demo `day1_vn_01`, "Test VN", on day 1).
- For scene-image cases: a file present at `apps/web/public/scenes/<name>` matching the
  scene cue value (the demo ships a placeholder `bookshop.jpg`).

---

## VN-01 — VN unit is listed and routed to the reader
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Open the day's chat list (Story → Chat) for a day with a VN unit.
  2. Tap the VN entry.
Expected: the VN unit lists alongside chats (marked `📖`); tapping it opens the
full-screen VN reader (not the chat feed) at `/play/day/<day>/vn/<id>`.

## VN-02 — One message at a time (replaces, no feed)
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Advance through several lines.
Expected: each new line replaces the previous one — only one message is on screen
at a time. There is no scrolling backlog of past lines.

## VN-03 — Word-by-word typewriter reveal
- area: vn
- priority: med
- platforms: [ios, android, web]
- automatable: no

Steps:
  1. Watch a line appear without touching the screen.
Expected: text reveals progressively (word by word), not all at once, at a
readable pace. When fully revealed it stops cleanly (no flicker).

## VN-04 — One adaptive button: Skip while typing, Next when done
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. While a line is still revealing, read the primary button label.
  2. After it finishes revealing, read it again.
Expected: the button reads **Skip** while typing and **Next** once the line is
complete. There is no separate second button to tap.

## VN-05 — Skip snaps to full instantly, no blink
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. While a line is mid-reveal, tap **Skip** (or tap the dialogue area).
Expected: the line jumps to its full text immediately and **stays** there — it
does not snap to full and then visibly resume typing (regression guard for the
reveal-timer cancellation).

## VN-06 — Tapping the dialogue area advances like the button
- area: vn
- priority: low
- platforms: [ios, android, web]
- automatable: no

Steps:
  1. Tap the dialogue box (not the footer button) while typing, then again when done.
Expected: tapping mid-reveal snaps the line to full; tapping a completed line
advances to the next — matching the Skip/Next button.

## VN-07 — Auto mode plays through unattended
- area: vn
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Toggle **Auto** on at the start of the VN.
Expected: each line reveals, holds a beat, then advances on its own with no taps.
The Auto button shows an on/pressed state. Toggling it off stops auto-advance.

## VN-08 — Auto pauses at a choice and resumes after picking
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Preconditions: Auto on, approaching a choice.
Steps:
  1. Let Auto reach the chooser.
  2. Pick an option.
Expected: Auto stops advancing while the chooser is shown (waits for input); after
the pick it resumes auto-advancing the following lines.

## VN-09 — Narrator prose vs character speech styling
- area: vn
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Observe a `narrator` line, then a named-character line.
Expected: `narrator` text shows as prose — no name, no avatar. A named character
(or MC) shows a styled speech caption with the speaker's name. No chat bubbles.

## VN-10 — Inline markup renders (`<b>` / `<i>` / `<u>`)
- area: vn
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Preconditions: a VN line containing a tag, e.g. `…breath <b>she curses his name</b>`.
Steps:
  1. Watch the line type out and settle.
Expected: the tagged span renders bold/italic/underline (not raw `<b>` text),
including while it types — no broken/visible tag fragments mid-reveal.

## VN-11 — Identical consecutive lines both animate
- area: vn
- priority: low
- platforms: [ios, android, web]
- automatable: yes

Preconditions: two adjacent VN lines with identical text (the demo has two).
Steps:
  1. Advance from the first to the second.
Expected: the second line re-runs the typewriter from empty (reveal is keyed on
the message, not its text) — it does not appear already-complete.

## VN-12 — Scene background renders from the scene cue
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: no

Preconditions: the VN's first content row is `cue | scene | <file>` and the file
exists in `public/scenes/`.
Steps:
  1. Enter the VN.
Expected: the named image fills the screen (cover), behind the dialogue box, with
the legibility overlay above it.

## VN-13 — Missing/empty scene falls back to a gradient
- area: vn
- priority: med
- platforms: [ios, android, web]
- automatable: no

Preconditions: a scene cue whose file is absent from `public/scenes/`, or a VN with
no scene cue.
Steps:
  1. Enter the VN.
Expected: the reader shows the default gradient background (never transparent /
broken) and remains fully usable.

## VN-14 — Scene crossfade on change
- area: vn
- priority: med
- platforms: [ios, android, web]
- automatable: no

Preconditions: a VN with a second `scene` cue partway through.
Steps:
  1. Advance past the second scene cue.
Expected: the background crossfades from the old image to the new one (a brief
dissolve, not an instant cut). Consecutive lines on the same scene do not re-fade.

## VN-15 — Music cue applies inside the VN
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: no

Preconditions: the VN authors a `cue | music | <theme>` row; audio unlocked (one
prior tap), media volume up.
Steps:
  1. Enter the VN and listen.
Expected: the cued theme plays (resolved like a chat: cue ▸ the VN thread's `ost`
▸ default) — the VN route is not stuck on app-ambient music. With no music cue and
no `ost`, the chat-default theme plays.

## VN-16 — Chooser appears as an overlay after the prompting line finishes
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Preconditions: a VN line immediately followed by a choice.
Steps:
  1. Let the prompting line reveal naturally (do not skip).
Expected: the chooser does **not** appear mid-reveal. After the line finishes plus
a brief beat (~1.5s), the options fade in as an overlay over the scene; the step
controls are hidden while it's shown.

## VN-17 — Chooser appears promptly after a Skip
- area: vn
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Preconditions: a VN line immediately followed by a choice.
Steps:
  1. Tap **Skip** on the prompting line.
Expected: the chooser appears almost immediately (~150ms), not after the full
natural beat — skipping signals intent to move on.

## VN-18 — Picking an option shows the MC's line and continues
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Preconditions: at a VN chooser that is **not** the end of the unit.
Steps:
  1. Pick an option.
Expected: the overlay closes, the chosen text shows as the MC's speech line, and
tapping **Next** continues to the following line (the answer is readable first —
it does not flash past).

## VN-19 — Final line ends without a redundant tap
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. Advance to the VN's last narration/speech line.
Expected: once that line is shown, **Exit** is reachable without an extra "Next"
that does nothing — the button is Skip while it types, then Exit when done (the
reader does not require a dead tap after the last line).

## VN-20 — Choice that ends the unit goes straight to Exit
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Preconditions: a VN whose final interaction is a choice (the demo ends this way).
Steps:
  1. Reach the final chooser and pick an option.
Expected: the MC's answer shows (Skip available while it types), then **Exit**
appears directly — no intervening "Next" tap. The sequence is pick → (skip?) →
Exit, not pick → Skip → Next → Exit.

## VN-21 — Exit returns to the day's chat list
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Finish the VN and tap **Exit**.
Expected: navigates back to that day's chat list; the completed VN shows a ✓ and is
dimmed.

## VN-22 — Effects/counters apply during VN play
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Preconditions: a VN whose lines/choices carry `effects` (axis/counter deltas).
Steps:
  1. Play through lines/choices that change `candles` / affinity.
Expected: the counter/affinity update as those items play (visible via candle
progress / dev console), matching the authored deltas.

## VN-23 — Interrupted VN is not completed; restarts from the start
- area: vn
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Open the VN, advance partway, then leave before the end.
  2. Re-open the same VN.
Expected: the VN is NOT marked complete and restarts from the beginning (no
mid-unit resume). No effects from the partial play persist.

## VN-24 — Replaying a completed VN strips effects
- area: vn
- priority: med
- platforms: [ios, android, web]
- automatable: yes

Preconditions: a VN already completed once.
Steps:
  1. Re-open the completed VN and play through it.
Expected: lines and the chooser still render, but effects do not re-apply (no
double-counting of candle/affinity deltas on a re-watch).

## VN-25 — Mixed-type thread is rejected at build (authoring guard)
- area: vn
- priority: med
- platforms: [web]
- automatable: yes

Preconditions: a `_manifest` where one `thread_id` has both a `vn` and a non-`vn`
segment.
Steps:
  1. Run content validation (`pnpm --filter @hyakuto/content validate <dir>`).
Expected: validation fails with a "mixes segment types" error — a unit's render
kind (chat vs VN) must be unambiguous. Likewise, an empty scene cue value and an
empty message both fail validation.
