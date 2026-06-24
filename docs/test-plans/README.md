# Test Plans

In-repo manual test cases. They version alongside the code, so when behaviour
changes the case changes in the same commit. The format is plain Markdown:
machine-parseable header fields + human-readable steps, usable three ways — a
manual checklist, a spec to generate automated tests from, and a basis for the
coding agent to test against.

## Plans

| Plan | Covers |
|------|--------|
| [audio.md](audio.md) | Background music: ambient themes, in-chat themes, cues, crossfades, iOS gesture/silent-switch. **Holds the field legend + case/run conventions.** |
| [chat.md](chat.md) | Thread playback: streaming, typing, choices, images, MC substitution, segment gating, effects, exit. |
| [persistence.md](persistence.md) | Save state: restart survival, hydration gate, idempotent commits, replay, reset. |
| [i18n.md](i18n.md) | UI localization (en/uk), live switching, interpolation, key parity. |

## Conventions (full legend in audio.md)

- **Case** = reusable definition (the `XXX-NN` entries). **Run** = a dated record
  of executing a set against one build; keep runs in tables so they never
  overwrite case definitions.
- **automatable**: `yes` (unit/Playwright-able) · `partial` · `no` (human only).
  The `no`/`partial` cases are the reason this manual base exists.
