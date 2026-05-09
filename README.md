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
| `block_id` | yes | Groups rows into blocks (e.g. `demo_1`) |
| `character` | for messages | Character ID — must match engine config (e.g. `Ao`, `Kou`, `Tatsumi`) |
| `type` | yes | Row type: `message`, `status`, `choice`, `typing` |
| `text` | for messages/status | Message content. Supports `{MC}` and `{@MC}` placeholders |
| `condition` | no | Boolean expression evaluated against game state (e.g. `story>4`, `candles<=40 AND flag:path_unlocked`) |
| `effect_1` | no | Affinity axis change in format `axis+delta` or `axis-delta` (e.g. `story+1`, `trust-2`) |
| `effect_2` | no | Additional effect |
| `effect_3` | no | Additional effect |
 
### Row Types
 
**message** — A chat message from a character. Consecutive rows with the same `block_id` and `character` are grouped (avatar shown once, tight spacing).
 
**status** — System message displayed as centered italic text (e.g. `{MC} joined the room.`).
 
**choice** — Player choice point. Each row is one option. The `text` column is the option label. Effects on choice rows apply when that option is selected.
 
**typing** — Explicit typing indicator. The engine also shows typing indicators automatically before messages.
 
### Condition Syntax
 
Conditions are boolean expressions evaluated against the current game state.
 
| Expression | Meaning |
|-----------|---------|
| `story > 4` | Axis value comparison |
| `candles <= 40` | Counter comparison |
| `flag:path_unlocked` | Flag is set |
| `NOT flag:ko_confronted` | Flag is not set |
| `story >= 5 AND candles <= 40` | Compound condition |
| `story > 3 OR trust > 5` | Either condition true |
| `(story > 3 OR trust > 5) AND candles <= 40` | Grouped with parentheses |
 
Spaces around operators are optional (`story>4` works the same as `story > 4`).
 
### Effect Format
 
Effects in the sheet use the shorthand format `axis+delta` or `axis-delta`. The Apps Script exporter converts these to structured objects:
 
| Sheet value | Exported JSON |
|-------------|---------------|
| `story+1` | `{ "axis": "story", "delta": 1 }` |
| `trust-2` | `{ "axis": "trust", "delta": -2 }` |
 
Axis names must match the `axes` array in the game config. The engine throws an error on unknown axes — this catches typos early.
 
### Apps Script Export
 
The Apps Script exporter reads the sheet and produces a JSON file matching the engine's `StoryFile` schema (array of blocks, each with typed items). Empty effect columns are skipped. The exported JSON is validated by Zod schemas on import.
 
## Environment Notes
 
- `apps/web/next.config.ts` has `output: 'export'` for Capacitor static builds. Remove this for Vercel deployment with server features.
- `transpilePackages` in Next config includes all three workspace packages so Next.js compiles their TypeScript.
- Tailwind v4 — colors and theme are defined in `apps/web/src/app/globals.css` under `@theme inline`, not in a config file.
- The dev console (floating debug panel) only renders in development mode.