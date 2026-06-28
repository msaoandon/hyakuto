# Test Plan — Audio (Background Music)

Manual test cases for background music: app ambient themes, in-chat themes,
scripted cues, and crossfades. These are the reusable **case definitions** — a
*test run* is a separate record of executing them against one build (see
[Recording a run](#recording-a-run)).

## How to read a case

Each case has a structured header and human steps:

- **id** — stable handle, e.g. `MUS-03`. Never renumber; retire instead.
- **area** — feature group (`audio`).
- **priority** — `high` (release-blocking) · `med` · `low`.
- **platforms** — where the case must pass: `ios`, `android`, `web`.
- **automatable** — `yes` (can be a Playwright/unit test) · `partial` (some
  assertions automatable, final judgement human) · `no` (human ears/eyes only).

`automatable: no/partial` cases are exactly why this plan exists — audible
crossfades and the iOS silent switch can't be unit-tested.

## Preconditions shared by most cases

- App built and synced to the device: `cd apps/web && pnpm build && npx cap sync <platform>`.
- Device **media volume up**; for the default cases the iOS **silent switch is OFF**.
- Fresh launch unless a case says otherwise.

---

## MUS-01 — No audio before the first user gesture
- area: audio
- priority: high
- platforms: [ios, android]
- automatable: no

Preconditions: fresh launch, sitting on the main screen, do not touch the screen.
Steps:
  1. Launch the app and wait ~10s without tapping anything.
Expected: complete silence. (iOS/Chromium block audio until a user gesture — this
is intended, not a bug.)

## MUS-02 — Ambient music starts on the first tap
- area: audio
- priority: high
- platforms: [ios, android]
- automatable: no

Preconditions: continues from MUS-01 (or fresh launch on main screen).
Steps:
  1. Tap anywhere (e.g. the Start button or language chooser).
Expected: the app ambient theme begins within ~1s and loops. It does not restart
on subsequent taps.

## MUS-03 — Time-of-day ambient theme selection
- area: audio
- priority: med
- platforms: [ios, android, web]
- automatable: partial   # pickAppMusic() is unit-testable; audible track is human

Preconditions: ability to change the device clock.
Steps:
  1. Set device time to 14:00, launch, tap to start music — note the track.
  2. Set device time to 22:00, relaunch, tap to start music — note the track.
Expected: daytime (06:00–17:59) plays `app_default`; night (18:00–05:59) plays
`app_night`. The two are audibly different.

## MUS-04 — Crossfade into a chat's theme
- area: audio
- priority: high
- platforms: [ios, android]
- automatable: no

Preconditions: ambient music playing (MUS-02 done).
Steps:
  1. From the Lobby open Story → Chat, then open a chat in the day's list.
Expected: the ambient theme fades out (~1.2s) while the chat theme fades in — a
smooth crossfade, no hard cut and no gap of silence.

## MUS-05 — Chat theme resolution: OST vs default
- area: audio
- priority: med
- platforms: [ios, android, web]
- automatable: partial   # resolution logic unit-testable; audible track human

Preconditions: a chat whose `_threads` row sets an `ost` theme, and one without.
Steps:
  1. Open a chat that declares an OST theme.
  2. Open a chat with no OST.
Expected: (1) plays the declared theme's folder(s); (2) falls back to
`chatDefault`. Neither goes silent.

## MUS-06 — Music cue mid-chat crossfades
- area: audio
- priority: high
- platforms: [ios, android]
- automatable: partial   # cue event assertable; audible crossfade human

Preconditions: a thread authored with a `cue / music / suspense` row partway through.
Steps:
  1. Play the chat until the cue fires.
Expected: the chat theme crossfades to the `suspense` theme at the cue, smoothly.

## MUS-07 — Music cue revert (`base`)
- area: audio
- priority: med
- platforms: [ios, android]
- automatable: partial

Preconditions: a thread with a `cue / music / suspense` then later `cue / music / base`.
Steps:
  1. Play past the `suspense` cue, then past the `base` cue.
Expected: at `base`, music crossfades back to the chat's base playlist (OST or
`chatDefault`) — not to silence.

## MUS-08 — Glitch cue does not affect music
- area: audio
- priority: med
- platforms: [ios, android]
- automatable: partial

Preconditions: a thread with a `cue / glitch / on` row while music is playing.
Steps:
  1. Play until the glitch cue fires.
Expected: music keeps playing unchanged — the glitch channel is independent of
the music channel. (Glitch's own visual/audio effect is out of scope here.)

## MUS-09 — Music continues across navigation
- area: audio
- priority: high
- platforms: [ios, android]
- automatable: no

Preconditions: music playing in a chat.
Steps:
  1. Exit the chat back to the day's chat list, then to the Lobby, then into
     another chat.
Expected: music never cuts out abruptly on navigation; it crossfades between
contexts and never fully stops/restarts mid-transition.

## MUS-10 — Mis-authored theme keeps current music
- area: audio
- priority: med
- platforms: [ios, android, web]
- automatable: yes   # switchTo() no-ops on empty url list

Preconditions: a cue or OST referencing a theme/folder with no audio files.
Steps:
  1. Trigger the bad theme.
Expected: the previous music keeps playing (no silence). In dev, a console warn
"theme resolved to no tracks" appears.

## MUS-11 — Multi-track playlist rotates
- area: audio
- priority: low
- platforms: [ios, android]
- automatable: no

Preconditions: a theme whose folder(s) contain 2+ tracks.
Steps:
  1. Let the first track play to its end.
Expected: the next track begins automatically; the playlist wraps after the last.
(Rotation is currently a hard cut between tracks — acceptable for now.)

## MUS-12 — iOS silent switch mutes music (known limitation)
- area: audio
- priority: med
- platforms: [ios]
- automatable: no

Preconditions: iOS device, music confirmed playing.
Steps:
  1. Flip the hardware silent/ring switch ON.
Expected: music goes silent (Web Audio respects the iOS silent switch). Switching
it OFF resumes audio. Documented behavior, not a bug — revisit only if we add a
native audio-session override.

## MUS-13 — Replaying a completed thread still plays music
- area: audio
- priority: low
- platforms: [ios, android]
- automatable: no

Preconditions: a thread already completed (shows ✓ in the day's chat list).
Steps:
  1. Re-open the completed thread.
Expected: music resolves and plays as on first play (replay strips state effects
but not audio).

---

## Recording a run

A *run* = executing a chosen set against one build. Keep runs in a dated table so
results don't overwrite the case definitions above. Example:

### Run 2026-06-24 — build dev, iPhone 13 (iOS 18) + Pixel 7 (Android 14)

| Case | iOS | Android | Notes |
|------|-----|---------|-------|
| MUS-01 | ✅ | ✅ | |
| MUS-02 | ✅ | ✅ | |
| MUS-04 | ✅ | ✅ | |
| MUS-12 | ✅ | n/a | Android has no silent switch |

Status legend: ✅ pass · ❌ fail (link an issue) · ⚠️ blocked · n/a not applicable.
