# MC — Player-Facing Customisation

*Design note required by DEV_PLAN Phase 2 (MC customisation). This file owns MC
customisation design until a fuller character-profiles doc exists; the Phase 3
picker UI implements what is specified here.*

## Customisation fields

The player customises the MC with exactly three fields, presented together in one
place (the Phase 3 picker, offered at first launch and editable in Settings):

| Field | What it drives | Default |
| --- | --- | --- |
| **Name** | The `{MC}` / `{@MC}` token in chat text and status lines | a neutral placeholder name |
| **Pronouns** | How the narration and UI copy refer to the player | they/them |
| **Gender (for address)** | The `gender:` condition predicate — lines other characters speak *to* the MC (`if_gender` authoring) | `unset` |

## Framing: "how characters address you"

Gender is presented as **how the cast addresses you**, never as an identity claim
or a demographic question. The picker copy says so explicitly (e.g. "How should
the others address you?"), and the options are address modes, not identities.

Two reasons this framing is load-bearing:

1. **Friendlier UX.** The player is casting themself in a story, not filling in a
   form. An address preference is diegetic — it belongs to the fiction, the way
   choosing a name does. It also makes `unset` a first-class option ("let them
   figure it out"), not a missing answer: `unset` is the engine default and every
   `gender:`-gated line must have a coherent unset path (the inclusive baseline —
   already enforced by the engine's default and exercised in tests).
2. **Smaller GDPR surface.** A gender *identity* is personal data with special-
   category gravity; an *address preference inside a game save* is game state.
   It lives in the opaque save blob (Phase 3: "MC customisation stored in an
   opaque save blob — not queryable structured fields"), is never used outside
   content resolution, and is deleted with the save (account deletion removes
   all player data). Keep it out of analytics, telemetry, and any queryable
   column — permanently.

## Engine mapping (already shipped)

- `gender:` predicate (`gender:female` / `gender:male` / `gender:unset`), a
  context-validated peer of `time:` — parse-time vocabulary check, evaluated
  against the durable save's `gender`, defaulting to `unset`.
- `{MC}`/`{@MC}` token substitution at render (chat + status lines).
- The save's `gender` field is optional/back-compat: legacy saves restore as
  `unset` with no migration.

## Authoring guidance (CMS)

Writers gate address-sensitive lines with the `gender:` predicate and must always
write the `unset` variant first — it is what every new player sees. Validation
(CMS step 5) should eventually warn when a segment has `gender:female`/`male`
variants of a line but no `unset` fallback.
