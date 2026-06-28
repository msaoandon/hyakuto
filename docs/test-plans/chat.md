# Test Plan — Chat Playback

Manual test cases for playing a thread: message streaming, typing indicators,
choices, images/stickers, MC substitution, segment gating, effects, and exit.

Field legend (id / area / priority / platforms / automatable) and the
case-vs-run distinction are documented in [audio.md](audio.md).

## Shared preconditions

- App built and synced: `cd apps/web && pnpm build && npx cap sync <platform>` (or `pnpm dev` for web).
- A known day with at least one playable thread (the demo content).

---

## CHAT-01 — Messages stream in authored order
- area: chat
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Preconditions: open a chat.
Steps:
  1. Watch the thread play from the start.
Expected: messages, statuses, and images appear in the order authored in the
block, newest at the bottom.

## CHAT-02 — Typing indicator precedes a character message
- area: chat
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Observe just before a non-MC character's message appears.
Expected: a typing indicator shows for that character, then is replaced by their
message. No typing indicator is shown for MC.

## CHAT-03 — Reply button enabled only when a choice is pending
- area: chat
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Steps:
  1. During non-choice playback, observe the Reply button.
  2. Wait until a choice point is reached.
Expected: Reply is disabled (dimmed, not tappable) until a choice is pending;
enabled once options are available; disabled again after a choice is made.

## CHAT-04 — Choosing an option renders the MC reply and advances
- area: chat
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Preconditions: at a choice point.
Steps:
  1. Tap Reply, pick an option in the modal.
Expected: the modal closes, the chosen text renders as an MC reply bubble, and the
thread continues past the choice.

## CHAT-05 — Image message opens and closes a viewer
- area: chat
- priority: med
- platforms: [ios, android, web]
- automatable: partial

Preconditions: a thread containing an image item.
Steps:
  1. Tap the image in the feed.
  2. Close the viewer.
Expected: tapping opens the full image modal; closing returns to the feed with
playback intact.

## CHAT-06 — MC name substitution
- area: chat
- priority: med
- platforms: [ios, android, web]
- automatable: yes

Preconditions: content using the `{MC}` token (e.g. status "{MC} joined the room.").
Steps:
  1. Observe rendered text containing `{MC}`.
Expected: `{MC}` is replaced everywhere with the player's name — in statuses,
messages, and choice option text. No literal `{MC}` remains visible.

## CHAT-07 — Segment condition gating hides a chat
- area: chat
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Preconditions: a thread with a `_threads` condition (e.g. demo_4 gated on
`candles < 60`), and game state on either side of the threshold.
Steps:
  1. With `candles >= 60`, open the day's chat list (Story → Chat) — note which
     chats list.
  2. Bring `candles < 60` (play the chats that reduce candles), revisit the chat
     list.
Expected: the gated chat is hidden while its condition is false and appears once
true. The list never shows a chat whose condition is unmet.

## CHAT-08 — Effects apply during play
- area: chat
- priority: high
- platforms: [ios, android, web]
- automatable: yes

Preconditions: a thread whose messages carry `effects` (axis/counter deltas).
Steps:
  1. Play through messages that change `candles` / affinity.
Expected: the counter/affinity updates as those items play (visible via candle
progress / dev console), matching the authored deltas. Image and sticker items
also fire their effects.

## CHAT-09 — Thread end shows Exit; Exit returns to the day's chat list
- area: chat
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Play a thread to completion.
  2. Tap Exit.
Expected: at the end the action button switches from Reply to Exit; tapping it
navigates back to that day's chat list (`/story/chat/<day>`).

## CHAT-10 — Completed thread is marked done
- area: chat
- priority: med
- platforms: [ios, android, web]
- automatable: yes

Preconditions: a thread just completed.
Steps:
  1. Return to the day's chat list.
Expected: the completed thread shows a ✓ and is visually de-emphasized (dimmed).

## CHAT-11 — Interrupted thread is not completed (no resume from middle)
- area: chat
- priority: high
- platforms: [ios, android, web]
- automatable: partial

Steps:
  1. Open a chat, play partway, then leave (back/navigate away) before the end.
  2. Re-open the same chat.
Expected: the thread is NOT marked complete and restarts from the beginning —
there is no mid-thread resume. No effects from the partial play are persisted.

## CHAT-12 — Dev console only in development
- area: chat
- priority: low
- platforms: [web]
- automatable: yes

Steps:
  1. Open a chat in a `pnpm dev` build, then in a production build.
Expected: the dev console (axes/counters/flags/last event) is visible in
development only and absent from production.

## CHAT-13 — Fullscreen chat background with translucent bars
- area: chat
- priority: low
- platforms: [ios, android]
- automatable: no

Steps:
  1. Open a chat on a notched device.
Expected: the chat background image fills the whole screen (behind header and
footer); header and footer are translucent black; the back arrow/title and the
Reply/Exit text stay legible over the brightest part of the image; content
respects the safe-area insets.
