**百灯**
 
**HYAKUTŌ**
 
─────── ◉ ───────
 
**DEVELOPMENT PLAN**
 
*Zero to Production*
 
v5 • June 2026 • Aligned with Engine Spec v2.0 • Progress-annotated
 
# **I. Overview**
 
This document is the authoritative development plan for Hyakutō, covering all phases from initial scaffold to production release and native deployment. It is aligned with the Game Engine Specification v2.0 and supersedes the phase table in the Technical Stack document.
 
The plan has seven engineering phases (0–6) plus a post-launch track. Testing is a continuous thread, not a phase. Content authoring runs in parallel with engineering and is called out explicitly where the pipelines must synchronise.
 
| **⚑ TESTING THREAD** | *Vitest is configured in Phase 0. Playwright and Storybook in Phase 2. CI enforcement in Phase 4. By full content authoring in Phase 5, every error-catching layer is load-bearing. Testing is never retrofitted.* |
| --- | --- |
 
| **⚑ SPEC ALIGNMENT** | *This plan is written against Engine Spec v2.0. The engine supports: five-level story hierarchy (Season → Route → Day → Segment → Message); four segment types (group_chat, dm, vn, system); randomised NPC message pools; full boolean condition expression language; multiple named counters; per-character typing rates; and a content compilation + server-side gating security model.* |
| --- | --- |
 
## **Progress Snapshot — June 2026**
 
Status legend used throughout: **✓ done**, **◐ in progress**, **○ not started**.
 
- **Phase 0 — Foundation: ✓ complete.** Tagged v0.1.0.
 
- **Phase 1 — Engine Core: ✓ complete.** Tagged v0.2.0. All engine systems, CLI playback, full Vitest coverage.
 
- **Phase 2 — Playable Proto: ◐ in progress.** Chat UI is well ahead (bubbles, grouping, avatars, typing, choice modal, dev console, per-character designs); choice resolver done. Not yet started: Zustand store, segment transition/assembly, VN rendering, candle animation, IndexedDB guest saves, the if_/do_ column refactor, context predicates, Playwright, Storybook.
 
- **Phases 3–6: ○ not started.**
 
**Work done ahead of / outside the plan:**
 
- Capacitor iOS + Android — running on real devices (a Post-Launch item, pulled early for layout testing).
 
- Cue system (music / glitch channels, state-persisting, condition-gated) — engine event + dev-console wiring.
 
- Sticker and image content types (image opens full-screen modal).
 
- Inline // message formatting (parser + tests).
 
- Whole-file (multi-tab) Apps Script exporter with stable filenames.
 
- Repo-side merge + validate pipeline in hyakuto-content (cross-file segment_id uniqueness, condition/axis/character/cue checks) — early Phase 4 content-integrity work.
 
## **Phase Summary**
 
| **Phase** | **Status** | **Goal (Definition of Done)** | **Key Scope Introduced** |
| --- | --- | --- | --- |
| 0 — Foundation | ✓ done | Monorepo alive. Hardcoded chat message on screen. | Next.js 15, TypeScript, Tailwind, Vitest, pnpm workspaces |
| 1 — Engine Core | ✓ done | Engine reads JSON and plays it back as simulated chat. | Five-level hierarchy schemas, four segment types, pool selection, condition parser, counters, typing rates |
| 2 — Playable Proto | ◐ in progress | A person plays through one full day with choices. | Zustand, Framer Motion, VN rendering, IndexedDB guest saves, Playwright, Storybook, if_/do_ column conventions, context predicates (time, gender) |
| 3 — Persistence | ○ not started | Progress saves. Close and reopen — continue exactly where you left off. | Prisma, SQLite, NextAuth (Google + Discord + Apple), GDPR baseline, guest-to-account migration |
| 4 — Content Pipeline | ○ not started | New JSON content added without touching app code. Pipeline catches all errors. | Content compilation, server-side gating API, ReactFlow admin, full CI checklist, Supabase swap |
| 5 — Full Content | ○ not started | Complete game playable from candle 100 to all endings. | All routes, all endings, full Playwright coverage, player dashboard |
| 6 — Ship | ○ not started | Playable by strangers. PWA installable. Push notifications working. | Serwist, Notification API, Vercel Cron, Web Push, production hardening |
| Post-Launch | ◐ partial (Capacitor done) | App Store and Google Play. Native push. Audio layer. | Capacitor, FCM, Howler.js |
 
# **II. Phase 0 — Foundation**
 
**Status: ✓ COMPLETE**
 
*Goal: The monorepo is alive. You can render a hardcoded chat message on screen.*
 
## **Deliverables**
 
- pnpm workspace scaffold with all four packages stubbed: hyakuto-engine, hyakuto-game, hyakuto-content, apps/web
 
- Next.js 15 App Router configured with TypeScript strict, Tailwind CSS, ESLint
 
- One hardcoded chat message renders in the correct visual style — correct font, bubble shape, avatar placeholder
 
- The –candle-progress CSS custom property wired to a manual slider, proving the amber → blue-gray → near-black colour shift works end-to-end
 
- Dependency flow enforced: engine ← game ← content ← app. No backwards imports.
 
- Zod installed in hyakuto-engine; placeholder schemas stubbed (MessageDef, SegmentDef) — empty but present
 
- Vitest configured in hyakuto-engine — zero tests written, but the runner works and the npm script exists
 
## **Testing in This Phase**
 
Vitest is configured from day one. No tests are written yet — the goal is to establish tooling before there is anything to test. When engine logic arrives in Phase 1, tests accompany it immediately.
 
| **✓ DONE WHEN** | *pnpm install **&**&** pnpm dev works from the monorepo root. A chat bubble is visible in the browser. A slider changes the page background colour. pnpm test exits 0.* |
| --- | --- |
 
# **III. Phase 1 — Engine Core**
 
**Status: ✓ COMPLETE**
 
*Goal: The engine reads a JSON file and plays it back as a simulated chat with correct timing. All core engine concepts are implemented.*
 
## **Scope Note**
 
Phase 1 is larger than it may appear. The Engine Spec v2.0 defines significantly more engine surface than a basic message queue. All of the following must be built here — the UI in Phase 2 depends on the complete contract.
 
## **Story Structure Schemas (hyakuto-engine + hyakuto-game)**
 
The engine supports a five-level hierarchy. All five levels need Zod schemas and TypeScript types before the content package can author anything.
 
- SeasonConfig — groups routes, declares romanceable characters per season. Lives in hyakuto-game, consumed by engine.
 
- RouteConfig — declares counter bindings, flags_manifest, and ordered ending conditions with the condition expression string. Lives in hyakuto-game.
 
- DayConfig — an ordered list of segment refs. Lives in hyakuto-content.
 
- SegmentDef — common envelope (id, type, route, day, characters_present, condition, scene) plus type-specific fields. Four valid types: group_chat, dm, vn, system.
 
- MessageDef — standard message fields (id, character, text, delay_ms, typing_ms, condition, delta, set_flag) plus the pool variant.
 
- narrator is a reserved character ID — registered automatically by the engine, no game config entry needed.
 
## **Message Queue ****&**** Timing (hyakuto-engine)**
 
- Message queue: loads a segment’s messages, drips them with configurable delay_ms and typing_ms
 
- Three timing modes: Live (delays honoured), Catch-Up (pre-rendered), Fast-Forward (all delays stripped)
 
- Auto-calculation: when delay_ms or typing_ms are absent, engine derives them from content length using the spec formula (BASE_TYPING + CHAR_RATE × length, clamped to MAX_TYPING)
 
- Per-character typing_rate: each character in game config declares a multiplier (e.g. Tatsumi: 1.4×, Kō: 0.6×) applied to auto-calculated timing before pace
 
- Pace control: four levels (Slow 1.5×, Normal 1.0×, Fast 0.5×, Skip 0×) applied as a final multiplier to all timing values — both auto-calculated and explicit writer overrides
 
- Typing indicator state exposed: isTyping, currentTypist, typingDuration
 
## **Randomised NPC Message Pools (hyakuto-engine)**
 
A pool is an array of message variants for a single NPC slot. The engine selects one variant per playthrough using recorded selection with intelligent exhaustion handling. This is non-trivial logic that belongs in Phase 1 — save serialisation in Phase 3 depends on it.
 
- Selection: unseen-first weighted sampling. When unseen variants remain, sample by weight. When exactly one remains, show it deterministically. When all seen, reset and resample.
 
- Recorded selection: the chosen idx is saved in game state (e.g. { msg_014: 1 }) so the player always sees the same message on reload.
 
- Pool message format: idx (stable, required), text, weight (optional). Reordering pool entries without preserving idx values fails CI.
 
## **Condition Expression Language (hyakuto-engine)**
 
Conditions are boolean expressions evaluated against the current game state. They appear at segment level, message level, and ending level. A string parser is required.
 
- Operands: counter value (candles <= 15), affinity axis (tatsumi_closeness >= 6), flag set (flag:third_path_unlocked), flag unset (NOT flag:ko_confronted), pool seen count (pool:msg_014.seen >= 2)
 
- Operators: AND, OR, NOT with parenthesis grouping. AND binds tighter than OR without parentheses.
 
- The parser takes a condition string and a GameState snapshot and returns boolean. Malformed expressions throw at parse time, not evaluation time.
 
## **Counters ****&**** Affinity (hyakuto-engine + hyakuto-game)**
 
- Generic counter system: any number of named counters, each with id, start, end, direction, tier thresholds, and on_complete behaviour. The candle counter is the first instance, not a hardcoded special case.
 
- Counter events: counter_changed fires on every value change, carrying the new tier if a threshold was crossed
 
- Affinity: per-character, multi-axis (trust, closeness, attraction). Each axis has bounds and starts at zero.
 
- Affinity deltas applied via the delta field on messages or choices, evaluated by the engine after the message is consumed.
 
- Flags: a per-route flag store. set_flag and clear_flag effects modify it. flag: predicates read it.
 
## **Engine Public Interface (hyakuto-engine)**
 
- createEngine(content, config, initialState) returns the public engine handle
 
- Event emission: message_emitted, choice_required, segment_complete, day_complete, counter_changed, ending_reached
 
- Choice handling: engine.choose(choiceId) advances the queue with the chosen branch
 
- Serialisation: engine.serialize() returns the full game state; engine.restore(state) rehydrates it
 
## **Content Pipeline (Phase 1 Baseline)**
 
- Google Sheets → Apps Script → JSON exporter scaffolded with the initial column set
 
- Pool message rows use type: pool; consecutive same-character rows auto-group in the exporter
 
- block_id auto-fills from previous row to reduce writer errors
 
- One JSON segment authored end-to-end to stress-test every schema and every engine system
 
## **Testing in This Phase**
 
- Vitest: condition parser — every operand, every operator, malformed inputs throw
 
- Vitest: pool selection — unseen-first sampling, deterministic exhaustion, weight distribution
 
- Vitest: timing formula — auto-calculation, per-character rate, pace multiplier composition
 
- Vitest: counter system — tier transitions, on_complete behaviour, event emission
 
- Vitest: serialisation round-trip — every state field survives serialize/restore
 
| **✓ DONE WHEN** | *A test harness loads the one stress-test JSON segment and plays it back to completion with correct timing, correct pool selection on repeat plays, correct condition gating, and full event emission. Every engine system is exercised by at least one Vitest case.* |
| --- | --- |
 
# **IV. Phase 2 — Playable Proto**
 
**Status: ◐ IN PROGRESS**
 
*Goal: A person plays through one full day with choices. The game runs in a browser, persists progress locally, and exercises every engine system in a real UI. The spreadsheet authoring grammar is formalised before content volume grows.*
 
## **Deliverables**
 
### **hyakuto-engine**
 
- **✓** Choice resolver: a choice modifies named variables; branching targets resolved against condition expressions
 
- **○** Segment transition: when a segment completes, the engine loads the next segment in the Day’s ordered list
 
- **○** Segment-level condition gating: a segment with a failing condition is skipped, the next segment loads automatically
 
### **apps/web — Group Chat ****&**** DM**
 
- **○** Zustand wired to engine state: candle count, affinity values, pace, current segment, message queue, typing state
 
- **◐** Full day-cycle UI: Main Hall (group_chat), DM shell (dm), Archive tab accessible
 
- **✓** Typing indicator animation — natural rhythm, character-specific pacing visible
 
- **✓** Player choice UI (implemented as a Reply button + choice modal): choices render in chat, player taps, queue resumes
 
- **○** Candle extinguishing animation (Framer Motion): flame dims, wisps, goes out. counter_changed event drives this.
 
### **apps/web — VN Segment Rendering**
 
The VN segment type is a distinct rendering mode, not a chat bubble variant. It requires explicit UI work in this phase.
 
- **○** Scene background: a declared scene ID maps to a background (colour, image, or gradient). Scene persists across consecutive narrator messages on the same scene ID.
 
- **○** Narrator message styling: distinct from chat bubbles — no avatar, no character name, prose-style typography
 
- **○** Character speech within a VN segment (e.g. Tatsumi speaking in the bookshop) renders as a styled caption over the scene, not a chat bubble
 
- **○** Scene transition: when scene ID changes, a brief crossfade. Framer Motion.
 
### **apps/web — Guest Persistence**
 
Guest mode saves progress locally before account creation. This is more than in-memory — the spec requires Zustand + IndexedDB.
 
- **○** IndexedDB adapter for Zustand: serialises game state to IndexedDB on key events (candle extinguished, segment complete, choice made)
 
- **○** Guest saves persist across page refreshes and tab closes. The player resumes from correct state without an account.
 
- **○** Guest mode cannot sync to Supabase — the account creation prompt appears before progress would be lost (approaching the end of The Warming tier)
 
### **hyakuto-content**
 
- **○** One complete day: morning group_chat, a vn segment, a dm, and an evening group_chat with one story told and one candle extinguished
 
- **○** The day must include a pool message and a conditional message so both systems are exercised in-game
 
### **Content Pipeline Refactor — Column Conventions**
 
Phase 1 shipped the spreadsheet pipeline with an ad-hoc effect format (effect_1/2/3 columns parsing inline syntax like “story+1, haruki-1”). Phase 2 formalises the convention before content volume grows. This is the last cheap moment to refactor the authoring grammar.
 
- **○** Column prefix convention: if_ for conditions, do_ for effects. One predicate or effect per column. Cross-column AND is the only compound logic the spreadsheet expresses. No inline AND/OR inside cells.
 
- **○** Apps Script exporter refactor: route columns by prefix. Each if_* column compiles to a predicate clause; the exporter joins all non-empty clauses with AND into a single condition string. Each do_* column compiles to a typed effect object; results aggregate into an effects array.
 
- **○** Effects parser refactor: replace the current effect_1/2/3 inline parser with typed compilation per column. do_flag, do_affinity, do_counter, do_ending each have their own validator and compiler. Adding the same effect type twice on one row uses numeric suffixes (do_affinity_1, do_affinity_2) only as needed — no schema-level cap on effect count.
 
- **○** Existing Phase 1 content migration: the one Phase 1 stress-test segment is updated to the new column format as part of this refactor. The Apps Script does not support both formats — clean cut, no grandfathering.
 
### **Context Predicates (hyakuto-engine)**
 
A new category of condition predicate evaluates against runtime context rather than GameState. Both initial members ship in Phase 2.
 
- **○** Parser signature change: evaluate(condition, gameState, runtimeContext) — runtimeContext carries time-of-day and MC customisation. Existing GameState predicates unaffected.
 
- **○** if_time predicate: time.band evaluated against new Date() at message resolution time, not segment load time. Named bands as engine primitives (morning, midday, afternoon, evening, night, late_night). Cell accepts a single band or comma-separated set; exporter compiles to time.band IN (…).
 
- **○** if_gender predicate: mc.gender evaluated against MC state. Three valid values — male, female, unset. unset is the default and the inclusive baseline. Writers add gendered variants only where the line genuinely changes character; the unset/default variant is the canonical line.
 
- **○** MC gender state field: added to game state in Phase 2 with default unset. The player-facing picker UI (“How should characters address you?”) ships in Phase 3 alongside the rest of MC customisation. Until then, all gameplay runs with the default and gendered variants are dead code paths — useful for testing the predicate logic without blocking on UI.
 
### **Authoring Documentation Updates**
 
Documentation updates ship with the refactor, not after.
 
- **◐** Column conventions reference (current effect_1/2/3 format documented in README; if_/do_ pending): the canonical list of valid if_* and do_* columns, what each accepts, and what each compiles to. Lives in the content package or a separate authoring guide.
 
- **○** “What to update when new columns are added”: a checklist for the recurring engine change — add the column to the Apps Script handler, add a Zod validator, add a parser case (predicate or effect compiler), add a Vitest case, update the column conventions reference. Five places, in order. Future-you (or a collaborator) follows the checklist instead of reverse-engineering five files.
 
- **○** MC customisation design note: the worldbuilding bible (or character profiles, whichever owns MC design) lists gender alongside name and pronouns as a player-facing customisation choice. Framed as “how characters address you,” not as an identity claim — friendlier UX, smaller GDPR surface.
 
## **Testing in This Phase**
 
- Vitest: choice resolver — correct branching, affinity delta application, impossible condition handling
 
- Vitest: segment transition — skipped segments, day_complete event fires after last segment
 
- Vitest: column-prefix exporter — if_* columns compile to expected condition clauses, do_* columns compile to expected effect objects, empty cells produce no contribution, unknown columns emit warnings
 
- Vitest: refactored effects parser — every do_* effect type round-trips through compile + apply correctly; old inline format no longer parses
 
- Vitest: context predicates — if_time evaluates against injected clock for all six bands; if_gender evaluates against all three MC states; both compose with existing GameState predicates under AND/OR/NOT
 
- Vitest: Phase 1 stress-test segment loads and plays correctly after migration to the new column format
 
- Playwright: happy path through one complete day including the VN segment. First e2e regression baseline.
 
- Playwright: guest persistence — play to a candle, close tab, reopen, verify state is restored from IndexedDB
 
- Storybook: chat bubble (all states), VN scene (with and without character speech), candle animation (lit, extinguishing, out), choice UI
 
| **✓ DONE WHEN** | *A playtester who has never seen the codebase can install the app, play through one full day including a VN scene and a DM, make a choice, and see the candle extinguish. Closing and reopening the tab restores their progress without an account. Playwright covers this path. The spreadsheet uses if_/do_ column conventions exclusively, with if_time and if_gender exercised by test rows.* |
| --- | --- |
 
# **V. Phase 3 — Persistence ****&**** Auth**
 
**Status: ○ NOT STARTED**
 
*Goal: Progress saves to the server. Close the app and come back to exactly where you left off.*
 
## **Deliverables**
 
### **Database ****&**** ORM**
 
- Prisma schema: player saves, relationship state (all affinity axes per character), counter values (generic — not just candles), story flags per route, pool seen history, MC customisation blob
 
- SQLite locally (zero-config). Supabase swap is Phase 4 — schema must be stable first.
 
- Zustand state syncs to DB on key events: candle extinguished, segment complete, DM milestone, choice made
 
- Save/load: multiple slots, save serialisation, load restores Zustand state fully
 
### **Auth**
 
- NextAuth.js with three OAuth providers: Google, Discord, and Apple Sign-In
 
Apple Sign-In differs structurally from Google and Discord — it hides the user’s email behind a relay address on first sign-in. The user record must not assume a real email is available. Test this separately.
 
- Guest-to-account upgrade: when a guest creates an account, the IndexedDB save from Phase 2 is migrated to Supabase. The player’s progress is not lost. This migration is a first-class feature, not an edge case.
 
- Session management integrated with Zustand
 
### **MC Customisation ****&**** GDPR Baseline**
 
- MC customisation picker: name, pronouns, gender-for-address (male / female / unset). The gender choice drives the if_gender predicate added in Phase 2 — picker UI catches up to the engine field this phase.
 
- MC customisation stored in an opaque save blob — not queryable structured fields
 
- Account deletion: removes all player data including save blobs and pool seen history. Built now, not retrofitted.
 
- Cookie consent UI
 
## **Testing in This Phase**
 
- Vitest: save serialisation round-trip — all state fields survive, opaque blob integrity, pool seen history preserved
 
- Vitest: guest-to-account migration — IndexedDB state maps correctly to Supabase schema
 
- Playwright: all three OAuth providers (Google, Discord, Apple)
 
- Playwright: save persistence — play to candle 95, close, reopen, verify restored state
 
- Playwright: account deletion removes all data
 
- Playwright: MC customisation picker — gender selection changes addressed lines in a test segment that uses if_gender
 
## **Content Work in This Phase**
 
No new story content required. Use this phase to review and revise Phase 2 JSON against the stable schema. Any schema changes made here are the last cheap changes — Phase 4 locks the schema by building tooling around it.
 
| **✓ DONE WHEN** | *A player creates an account (via any of the three providers), plays through Phase 2 content, closes the browser, reopens the next day, and continues from the correct candle and affinity state. A guest migrating to an account loses no progress. Account deletion removes all their data. MC customisation including gender-for-address is persisted and drives if_gender variants correctly.* |
| --- | --- |
 
# **VI. Phase 4 — Content Pipeline ****&**** Writer Tooling**
 
**Status: ○ NOT STARTED (merge+validate started early)**
 
*Goal: New story content can be added without touching the application codebase. The pipeline catches all structural errors before they reach production.*
 
## **Content Compilation (Build Step)**
 
Writers author in JSON (via the Sheets → Apps Script pipeline). At build time, the JSON is compiled to a binary format optimised for runtime delivery.
 
- Incremental compilation: only changed files recompile. Build time measured against The Warming tier as a proxy for full-game scale.
 
- Compilation validates against all Zod schemas. Any failure blocks the build.
 
- Compiled output split by candle tier to support pre-fetching on tier transitions
 
## **Server-Side Gating API**
 
- Content delivery routes guard by player progress: a request for tier-3 content from a player at tier-1 returns 403
 
- Pool message resolution happens server-side. Client receives only the resolved flat message array — pool variants and their conditions never leave the server.
 
- Affinity delta application happens server-side. Client cannot manipulate state through devtools.
 
- Auth guards and rate limiting on every content route
 
## **CI Nine-Check Suite**
 
Every PR that touches content runs the full validation suite. A failure blocks merge.
 
- Zod schema validation across all content files
 
- Pool idx stability check (no reordering without preserving ids)
 
- Condition expression parseability (no malformed expressions)
 
- Flag manifest completeness (every flag referenced exists in flags_manifest)
 
- Ending condition reachability sanity check
 
- Character ID validity (every referenced character exists in game config)
 
- Scene ID validity (every referenced scene exists)
 
- Counter binding validity (every counter referenced is declared)
 
- Column convention compliance (every spreadsheet column matches if_*/do_* convention or is a known structural column)
 
## **Admin Tooling**
 
- ReactFlow-based segment graph viewer: visualises a route’s segment ordering and conditional branches
 
- Chat preview panel: dev-only UI to play any segment in isolation against a synthetic GameState
 
- Floating dev console (existing) extended with the runtime context predicate values (current time band, mc.gender)
 
## **Supabase Swap**
 
Local SQLite (Phase 3) → Supabase Postgres. Performed once, before real users exist. Save data migrated on a staging branch first.
 
## **Content Authoring**
 
Candles 100–71 — The Warming tier — authored end-to-end. This is the volume calibration test. If it takes longer than expected, the Phase 5 timeline adjusts before it is critical.
 
| **✓ DONE WHEN** | *A new JSON segment can be added by a writer working only in the spreadsheet, exported via Apps Script, committed, validated by CI, and played without any application code changes. The Warming tier is complete and playable end-to-end.* |
| --- | --- |
 
# **VII. Phase 5 — Full Content**
 
**Status: ○ NOT STARTED**
 
*Goal: The complete game is playable from candle 100 to all endings, on all romance routes.*
 
## **Content Deliverables**
 
- Candles 70–1 authored across all romance routes (Tatsumi, Ren, Kō, Haruki, Mio, Kaname)
 
- All good endings and all bad endings authored
 
- Third Path ending (sabotage with Haruki) authored and gated correctly
 
- DLC Lurker route segments authored (post-launch content, gated separately)
 
## **Engineering Polish**
 
- Accessibility pass: keyboard navigation, screen reader labels, reduced motion mode
 
- Player dashboard: route progress, affinity overview, candle count, achievements (if scoped)
 
- Storybook coverage extended to every visual state in the game
 
- DLC route hooks: the engine supports loading additional route content without main bundle changes
 
## **Testing in This Phase**
 
- Playwright: every route reaches at least one ending
 
- Playwright: Third Path gate — sabotage requires correct conditions; cannot be reached otherwise
 
- Playwright: ending first-match ordering — multiple satisfied conditions resolve to the first in route config
 
- Manual: full playthrough of every route by Julia before each tier milestone (70–41, 40–11, 10–1)
 
| **✓ DONE WHEN** | *Every route has a complete arc from candle 100 to at least one good and one bad ending. The Third Path is reachable under correct conditions. Manual playthrough of all routes confirms narrative coherence. No new engine features added in this phase — engineering is finished.* |
| --- | --- |
 
# **VIII. Phase 6 — Ship**
 
**Status: ○ NOT STARTED**
 
*Goal: Playable by strangers. PWA installable. Push notifications working.*
 
## **PWA**
 
- Serwist service worker: offline support for cached content
 
- Web app manifest: install prompt on iOS and Android browsers
 
- Cached content includes the current candle tier — players can play offline once tier content is fetched
 
## **Push Notifications**
 
- Notification API: opt-in flow during onboarding
 
- Vercel Cron: scheduled message delivery for Immersive Mode (timed flavor messages between sessions)
 
- Web Push API: notification delivery to subscribed browsers
 
- Two tiers: low-frequency (route milestones) and high-frequency (Immersive Mode opt-in)
 
## **Production Hardening**
 
- Content API routes: auth guards, rate limiting, 403 gating verified against edge cases
 
- Privacy policy and terms of service
 
- GDPR data export (complements the deletion flow from Phase 3)
 
- Error monitoring: unhandled exceptions in the engine surface as alerts
 
## **Soft Launch**
 
- Limited access release — Discord community, social media following
 
- Feedback collection loop: lightweight mechanism for bug reports and player reactions before wide release
 
## **Testing in This Phase**
 
- Playwright: PWA install flow, offline mode (service worker intercepts requests, cached content loads)
 
- Playwright: push notification registration (both tiers)
 
- Manual: install PWA on iOS and Android. Test notification prompt. Test offline play.
 
- Security review: RLS policies, content API auth guards, save blob opaqueness, rate limiting
 
| **✓ DONE WHEN** | *A stranger with the link can install the app on their phone, play through The Warming tier, receive a notification for the next session, and resume the next day. No account required for the first few candles.* |
| --- | --- |
 
# **IX. Post-Launch**
 
**Status: ◐ PARTIAL — Capacitor iOS/Android running on device**
 
*Native apps, push via FCM, and audio. These wait until the web version is stable.*
 
## **Capacitor Native Builds**
 
- Wrap the existing PWA with Capacitor — same codebase, minimal code changes
 
- App Store (iOS) and Google Play (Android) submissions
 
- Haptic feedback on candle extinguishing
 
- Background fetch for Immersive Mode timed messages on native
 
## **Firebase Cloud Messaging**
 
- Upgrade push delivery layer from Web Push to FCM for native builds
 
- Scheduling logic unchanged — only the delivery adapter changes. Built for this in Phase 6.
 
- Both iOS and Android push delivered through FCM
 
## **Audio Layer**
 
- Howler.js: ambient soundscape, candle extinguishing sounds, story session audio shifts
 
- Candle tier-aware: warm amber tone in The Warming, mounting tension past candle 40, near-silence past candle 10
 
- AudioProvider at root layout level — planned for in component tree from Phase 2, no refactor needed
 
- Mobile autoplay handled: Howler manages Web Audio API autoplay restrictions
 
| **✓ DONE WHEN** | *The game is in the App Store and Google Play with native push and ambient audio. Web and native share one codebase.* |
| --- | --- |
 
# **X. The Testing Thread**
 
Testing is not a phase. It starts at Phase 0 and grows continuously with the project.
 
| **Tool** | **Introduced** | **What It Tests** | **Trigger** |
| --- | --- | --- | --- |
| Vitest | Phase 0 | Engine logic: message queue, timing formula, pool selection, condition parser, counter system, affinity, flags, Zod schemas, ending evaluation, exporter compilation, context predicates | pnpm test — local and CI |
| Storybook | Phase 2 | Visual component states: chat bubbles, VN scenes, candle states, colour shift stages, DM interface, choice UI, Lurker variants | pnpm storybook — local development |
| Playwright | Phase 2 | User journeys: full day, VN segment, auth flows, save persistence, guest migration, romance milestones, ending paths, PWA install, offline, MC customisation | pnpm e2e — CI on every PR |
| Zod + CI | Phase 4 | Content integrity: all nine spec-defined checks run on every PR. A broken file blocks merge. | GitHub Actions — automatic |
 
## **Coverage Priorities**
 
- **Highest:**** **Engine logic. Message queue, pool selection, condition parser, ending evaluation, exporter compilation. Pure functions, no dependencies. Test thoroughly.
 
- **High:**** **Save/load serialisation including pool seen history. Data corruption is unrecoverable.
 
- **High:**** **Ending conditions. Third Path gate, sabotage triggers, first-match ordering must match exactly.
 
- **High:**** **Content delivery gating. A player must not receive content they have not reached.
 
- **Medium:**** **Auth flows and GDPR operations. Infrequent but legally significant.
 
- **Lower:**** **React component internals. Storybook covers visual states; Playwright covers journeys.
 
## **What Not to Test**
 
- React component internals — use Playwright for behaviour, Storybook for visual states
 
- Prisma queries directly — test save/load behaviour, not SQL
 
- Third-party library behaviour (Framer Motion, NextAuth OAuth redirects, Howler playback)
 
# **XI. Content ****&**** Engineering Pipeline**
 
The writing pipeline and the engineering pipeline intersect at two points: schema definition (Phase 1) and tooling availability (Phase 4). Outside those intersections they run independently.
 
| **Phase** | **Engineering** | **Content / Writing** |
| --- | --- | --- |
| 0 | Monorepo scaffold, rendering, CSS custom property | Nothing. Schema does not exist yet. |
| 1 | All engine systems: schemas, queue, timing, pools, condition parser, counters, flags | One JSON segment to stress-test the schema. Find problems while they are cheap. |
| 2 | Choice resolver, Zustand, VN rendering, IndexedDB guest saves, Playwright, column convention refactor, context predicates | One complete day including a VN segment and a DM. Phase 1 stress-test segment migrated to if_/do_ column format. |
| 3 | Persistence, auth (incl. Apple), guest-to-account migration, MC customisation picker, GDPR baseline | Revise Phase 2 JSON against stable schema. Last cheap schema changes. |
| 4 | Content compilation, server-side gating API, CI nine-check suite, admin tooling, Supabase swap | Candles 100–71 (The Warming) — full opening act authored and validated. |
| 5 | Polish, accessibility, player dashboard, Storybook, DLC route hooks | Candles 70–1, all romance routes, all endings, DLC Lurker route segments. |
| 6 | PWA, push notifications, production hardening, soft launch | Bug fixes and line revisions from soft launch feedback. No new routes. |
 
Content authoring starts seriously in Phase 4, not earlier. The compilation step and chat preview panel need to exist before writing at scale. The tooling earns its existence before you depend on it.
 
# **XII. Risks ****&**** Mitigations**
 
| **Risk** | **Where It Bites** | **Mitigation** |
| --- | --- | --- |
| Condition expression parser is more complex than expected | Phase 1 | Build the parser before any content depends on it. The one Phase 1 JSON file exercises it immediately, surfacing scope problems early. |
| Schema changes break existing JSON after Phase 1 | Phase 1–3 | Schema changes are explicitly the goal of Phase 1. Phase 2 also includes a planned authoring-grammar refactor (if_/do_ columns, context predicates) and migrates the Phase 1 stress-test segment. By Phase 4 the schema is locked by CI. Make breaking changes early, never late. |
| Column convention refactor leaves stale content behind | Phase 2 | The Apps Script does not support both old and new formats — clean cut. The Phase 1 stress-test segment is migrated as part of the refactor PR, validated by Vitest. No grandfathering window where two formats coexist. |
| Apple Sign-In relay email causes user record issues | Phase 3 | Treat email as nullable from day one. Never assume a real email address is available. Test the Apple OAuth path explicitly. |
| Guest-to-account migration corrupts progress | Phase 3 | Vitest round-trip test for the IndexedDB → Supabase migration. Playwright e2e test for the upgrade flow. |
| Content compilation step is slow at full scale (100 candles) | Phase 4 | Incremental compilation: only recompile changed files. Measure build time with The Warming tier (30 candles) as a proxy. |
| Server-side gating adds latency to tier transitions | Phase 4 | Pre-fetch the next tier’s compiled segments when the player reaches the boundary candle. Player never waits mid-play. |
| Supabase migration breaks save data | Phase 4 | Swap before real users exist. Test migration on a staging branch before merging to main. |
| Content volume underestimated in Phase 5 | Phase 5 | The Warming tier (Phase 4) is the volume calibration test. If it takes longer than expected, Phase 5 timeline adjusts before it is critical. |
| App Store review rejects the Capacitor build | Post-Launch | Web version is in production and earning trust before native submission. A rejection delays native, not the game. |
| Solo dev burnout on content volume | Phase 5 | Phase 5 is the longest phase intentionally. Break into tier milestones (70–41, 40–11, 10–1) with rest between. Engineering is finished. |
 
百灯 / Hyakutō • Development Plan v4 • Aligned with Engine Spec v2.0 • May 2026 • Confidential
