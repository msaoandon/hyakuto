# 百灯 Hyakutō — Development Notes
 
## Prerequisites
 
- Node.js 20+ (via nvm: `nvm alias default 20`)
- pnpm (`npm install -g pnpm`)
- Xcode (for iOS deployment)
- Android Studio (for Android deployment)
- tsx (`pnpm --filter @hyakuto/engine add -D tsx`)
## Project Structure
 
```
hyakuto/
├── packages/
│   ├── hyakuto-engine/    # Framework-agnostic game engine (MIT)
│   ├── hyakuto-game/      # Hyakutō-specific config
│   └── hyakuto-content/   # Story files (JSON)
├── apps/
│   └── web/               # Next.js frontend
├── pnpm-workspace.yaml
└── tsconfig.base.json
```
 
## Getting Started
 
```bash
pnpm install
pnpm dev              # starts Next.js on localhost:3000
pnpm test             # runs Vitest across all packages
```
 
## Web App (apps/web)
 
### Development
 
```bash
pnpm dev
```
 
### Build
 
```bash
pnpm build
```
 
## Engine CLI (packages/hyakuto-engine)
 
Run any story JSON file in the terminal with full engine support — timing, conditions, choices, pool selection.
 
```bash
pnpm --filter @hyakuto/engine cli path/to/story.json
```
 
The CLI uses the same engine as the web UI. Changes to engine logic are testable in the terminal without starting the browser.
 
### Run Tests
 
```bash
pnpm --filter @hyakuto/engine test         # single run
pnpm --filter @hyakuto/engine test:watch   # watch mode
```
 
## Deploy to iPhone
 
Requires a free Apple ID configured in Xcode (Settings → Accounts → add your Apple ID).
 
### First-time Setup
 
```bash
cd apps/web
pnpm add @capacitor/core
pnpm add -D @capacitor/cli
npx cap init Hyakuto com.msaoandon.hyakuto --web-dir out
pnpm add @capacitor/ios
npx cap add ios
```
 
### Build and Deploy
 
```bash
pnpm --filter @hyakuto/web build     # static export to apps/web/out/
cd apps/web && npx cap sync          # copy build to native project
npx cap open ios                     # opens Xcode
```
 
In Xcode:
 
1. Select your iPhone (plugged in via USB) as the build target
2. Under Signing & Capabilities, select your Personal Team
3. Press ▶ to build and deploy
On first install, the phone asks you to trust the developer: Settings → General → VPN & Device Management → your Apple ID → Trust.
 
Free accounts require re-deploying every 7 days.
 
### Convenience Scripts
 
Already configured in `apps/web/package.json`:
 
```bash
pnpm --filter @hyakuto/web cap:build     # next build + cap sync
pnpm --filter @hyakuto/web cap:ios       # opens Xcode
```
 
## Deploy to Android
 
Requires Android Studio with Android SDK. Enable Developer Mode on your phone (Settings → About Phone → tap Build Number 7 times), then enable USB Debugging in Developer Options.
 
### First-time Setup
 
```bash
cd apps/web
pnpm add @capacitor/android
npx cap add android
```
 
### Build and Deploy
 
```bash
pnpm --filter @hyakuto/web cap:build     # next build + cap sync
pnpm --filter @hyakuto/web cap:android   # opens Android Studio
```
 
In Android Studio, select your device and press ▶.
 
## Google Sheet Content Format

Story content is authored in a Google Sheet and exported to JSON via Apps Script.

### Sheet Columns

| Column | Required | Description |
|--------|----------|-------------|
| `block_id` | yes | Groups rows into blocks (e.g. `demo_1`). Empty cells auto-fill from the row above |
| `character` | for messages | Character ID — must match engine config (e.g. `Ao`, `Kou`, `Tatsumi`). On `choice` rows, set to `dev` for a dev-voiced choice; leave blank for MC |
| `type` | yes | Row type: `message`, `status`, `choice`, `typing`, `pool`, `sticker`, `image`, `cue` |
| `channel` | for cues | Cue channel: `music`, `glitch`, etc. |
| `value` | for cues | Target state for the channel (e.g. `ambient_01`, `on`) |
| `text` | for messages/status | Message content. Supports `{MC}` and `{@MC}` placeholders, and inline `<b>`, `<i>`, `<u>` formatting tags. For `sticker`/`image` rows, the filename |
| `weight` | for pools | Relative selection weight of a pool variant (default 1) |
| `if_*` | no | A condition column. One predicate per cell (e.g. `candles<60`, `flag:path_unlocked`). All non-empty `if_` cells on a row are AND-ed together — see *Authoring grammar* below |
| `do_affinity_1`, `do_affinity_2` | no | An affinity change, `axis±n` (e.g. `tatsumi+1`, `ren-1`). **Max 2 per row** — so one row can raise one character and lower another |
| `do_counter` | no | A counter change, `counter±n` (e.g. `candles-1`) |

> Deferred (not yet active): `do_flag` (needs a flags manifest), `if_time` / `if_gender` (context predicates), `do_ending` (Phase 5).

### Authoring grammar: `if_` and `do_`

Two column families drive conditions and effects, by **column-name prefix**:

- **`if_*` decides whether the row plays.** Put one predicate per `if_` cell. The exporter wraps each in parentheses and joins all non-empty ones with `AND`. Add as many `if_` columns as you need (`if_1`, `if_2`, …) — they all AND together. For the rare `OR`, write it inside a single cell: `(story>3 OR trust>5)`.
- **`do_*` fires when the row plays.** All `do_` cells on the row apply together, after it shows. A `do_` with no `if_` is simply unconditional.

Because the `if_` gate is **row-scoped**, every `do_` on a row shares it. To make one effect conditional and another not, put them on **separate rows** — for choices that's automatic (each option is its own row).

| block_id | character | type | text | if_1 | do_affinity_1 | do_affinity_2 | do_counter |
|----------|-----------|------|------|------|---------------|---------------|------------|
| d_7 | Ren | message | I'll help you | flag:route_x | tatsumi+1 | ren-1 | candles-1 |

This row only plays if `flag:route_x` is set; when it does, it raises `tatsumi`, lowers `ren`, and burns a candle.

### Row Types

**message** — A chat message from a character. Consecutive rows with the same `block_id` and `character` are grouped (name shown once, avatar on the last). Text supports `<b>`, `<i>`, `<u>` tags and `\n` line breaks.

**status** — System message displayed as centered italic text (e.g. `{MC} joined the room.`).

**choice** — Player choice point. Consecutive `choice` rows collapse into one choice block; each row is one option. The `text` column is the option label. Effects apply when that option is selected. Set `character` to `dev` for a dev-voiced choice (right-aligned, distinct colour); blank means MC.

**typing** — Explicit typing indicator. The engine also shows typing indicators automatically before messages.

**pool** — A randomised message variant. Consecutive `pool` rows from the same character form one pool; the engine picks one per playthrough, weighted by the `weight` column. The chosen variant is recorded so reloads show the same line.

**sticker** — Inline sticker or emoji image. The `text` column holds the filename (from `/stickers/`). No text body, renders inline.

**image** — A shared image, tappable to open full screen. The `text` column holds the filename (from `/images/`).

**cue** — A presentation directive (music, glitch, etc.). Renders no bubble. Set the `channel` and put the target state in `value`. `character` and `text` stay empty.

### Cue Channels

Cues set the state of a named **channel**, and that state holds until another cue changes it — there are no start/end pairs. Channels are **independent**: `music` and `glitch` can both be active at once, and turning one off leaves the other untouched. To stop an effect, set its channel to that channel's off value (each has its own).

| channel | turn on | turn off |
|---------|---------|----------|
| `music` | a theme name (e.g. `suspense`, `chat_night`) | `base` — revert to the chat's OST/default playlist (not silence) |
| `glitch` | `on` | `off` |

A `music` value is a **theme** (a folder under `public/music/`); see the *Threads Tab* OST notes. A cue can carry a `condition` like any other row — e.g. a glitch cue gated on `sanity<5` only fires when the player is rattled.

Example — suspense music + glitch turn on as a ghost story begins, then **both turn off** when discussion resumes (note each channel has its own off row, and they don't cancel each other):

| block_id | character | type | channel | value | text |
|----------|-----------|------|---------|-------|------|
| demo_5 | | cue | music | suspense | |
| demo_5 | | cue | glitch | on | |
| demo_5 | Kou | message | | | the well was never empty |
| demo_5 | | cue | glitch | off | |
| demo_5 | | cue | music | base | |

### Condition Syntax (inside `if_` cells)

Each `if_` cell holds one boolean predicate, evaluated against the current game state. Multiple `if_` cells on a row AND together (see *Authoring grammar*).

| Expression | Meaning |
|-----------|---------|
| `story > 4` | Axis value comparison |
| `candles <= 40` | Counter comparison |
| `flag:path_unlocked` | Flag is set |
| `NOT flag:ko_confronted` | Flag is not set |
| `story > 3 OR trust > 5` | Either side true — keep `OR`/grouping **inside one cell** |
| `(story > 3 OR trust > 5)` | Parenthesised group within a cell |

Spaces around operators are optional (`story>4` works the same as `story > 4`). Don't write `AND` across a cell — use separate `if_` columns for that; `AND` is the cross-column behaviour.

### Effect Format (inside `do_` cells)

`do_affinity_*` and `do_counter` cells use the shorthand `target+delta` / `target-delta`. The exporter compiles each to a structured effect:

| Column | Sheet value | Exported JSON |
|--------|-------------|---------------|
| `do_affinity_1` | `tatsumi+1` | `{ "axis": "tatsumi", "delta": 1 }` |
| `do_affinity_2` | `ren-2` | `{ "axis": "ren", "delta": -2 }` |
| `do_counter` | `candles-1` | `{ "axis": "candles", "delta": -1 }` |

Targets must match the game config (`axes` for affinity, `counters` for counters). The engine throws on an unknown target — this catches typos early. A third `do_affinity_*` on one row is ignored with a warning.
 
### Manifest Tab (`_manifest`)

The `_manifest` tab declares how segments assemble into days and how each segment is gated. It is read separately from the message tabs — any tab whose name starts with `_` is skipped by the message parser. One row per segment.

| Column | Required | Description |
|--------|----------|-------------|
| `day` | yes | Day number this segment belongs to |
| `order` | yes | Position within the day — segments are sorted by `order`, not row position |
| `route` | yes | Route this day belongs to (e.g. `tatsumi`) |
| `segment_id` | yes | Stable segment slug. Joins to a message block via its `block_id`. A blank cell silently drops the row |
| `seg_type` | yes | Segment type: `group_chat`, `dm`, `vn`, or `system` |
| `thread_id` | chat types | Chat-list grouping key (e.g. `main_hall`, `dm_ren`). Segments sharing a `thread_id` render as one chat thread. Blank for `vn`/`system` |
| `characters_present` | no | Comma-separated character IDs (e.g. `Ao,Kou,Ren`) |
| `scene` | for vn | Scene background ID for VN segments |
| `condition` | no | Gate expression (same syntax as message conditions). If it evaluates false against game state, the segment is skipped and the next one loads automatically |

Example:

| day | order | route | segment_id | seg_type | thread_id | characters_present | scene | condition |
|-----|-------|-------|------------|----------|-----------|--------------------|-------|-----------|
| 1 | 1 | tatsumi | day1_morning | group_chat | main_hall | Ao,Kou,Ren | | |
| 1 | 2 | tatsumi | day1_bookshop | vn | | Tatsumi | bookshop_interior | flag:met_tatsumi |
| 1 | 3 | tatsumi | day1_ren_dm | dm | dm_ren | Ren | | candles<=90 |

The exporter turns this tab into:

- **`days`** — one entry per `(route, day)`, listing its `segment_id`s in `order`:
  ```json
  { "day": 1, "route": "tatsumi", "segments": ["day1_morning", "day1_bookshop", "day1_ren_dm"] }
  ```
- **`segments`** — the per-segment envelope (`type`, `condition`, `thread_id`, `scene`, `characters_present`), keyed by `segment_id`.

The engine consumes these to play a day in order, skipping any segment whose `condition` fails — `engine.loadDay(day, segments)` then `engine.playDay()`.

### Threads Tab (`_threads`)

Per-thread display and presentation metadata — one row per `thread_id`. A thread groups segments (across days for DMs), so its name and music live here once rather than on every segment row.

| Column | Required | Description |
|--------|----------|-------------|
| `thread_id` | yes | Joins to the `thread_id` used in `_manifest` |
| `display_name` | yes | Chat name shown in the day's chat list |
| `condition` | no | Gate for the whole thread (same syntax as message conditions) |
| `ost` | no | Music **theme** for this chat — a theme name (e.g. `chat_night`). Blank → the default chat theme. Use a **dropdown** (Data → Data validation → list of theme names) for consistency |

Exported into `threads: { [thread_id]: { display_name, condition?, ost? } }`. A theme is a set of folders under `public/music/`; the app's AudioProvider pools their tracks into one playlist (one file loops, many rotate). A blank `ost` falls back to the default chat theme.

### Apps Script Export

The exporter produces **two files** per spreadsheet:

- `hyakuto_<name>.json` — message content: an array of blocks (the `StoryFile` schema), each with typed items. Format unchanged.
- `hyakuto_<name>_manifest.json` — `{ days, segments }` from the `_manifest` tab.

The two are joined at load time by `segment_id` === `block_id`: the manifest supplies each segment's envelope (type, gate condition, thread), the content file supplies its messages. The exporter logs a warning for any manifest segment with no matching block, or any block missing from the manifest. Empty effect columns are skipped. Exported JSON is validated by Zod schemas on import.

Menu items: **Export spreadsheet as JSON** (writes both files), **Show JSON in dialog** (content), **Show manifest JSON in dialog** (manifest).
 
## Environment Notes
 
- `apps/web/next.config.ts` has `output: 'export'` for Capacitor static builds. Remove this for Vercel deployment with server features.
- `transpilePackages` in Next config includes all three workspace packages so Next.js compiles their TypeScript.
- Tailwind v4 — colors and theme are defined in `apps/web/src/app/globals.css` under `@theme inline`, not in a config file.
- The dev console (floating debug panel) only renders in development mode.