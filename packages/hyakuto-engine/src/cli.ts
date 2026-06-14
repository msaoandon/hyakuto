import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { StoryFile } from "./schemas/block";
import { createEngine, type EngineEvent } from "./engine";
import type { GameConfig } from "./schemas/game-config";
import { assembleThread, listDays, listThreads, type Manifest } from "./manifest/manifest";

// ─── CONFIG ──────────────────────────────────────────────
// NOTE: duplicated from @hyakuto/game on purpose — the CLI lives inside
// @hyakuto/engine, and @hyakuto/game depends on @hyakuto/engine, so importing
// it here would be a dependency cycle. A later step can load config from data.

const MC_NAME = "You";

const gameConfig: GameConfig = {
  axes: ["weirdness", "patience", "sanity"],
  characters: [
    { id: "Ao", typing_rate: 1.0 },
    { id: "Kou", typing_rate: 0.6 },
    { id: "Haruki", typing_rate: 0.8 },
    { id: "Tatsumi", typing_rate: 1.4 },
    { id: "Ren", typing_rate: 1.2 },
    { id: "Suzune", typing_rate: 1.0 },
  ],
  counters: [{ id: "candles", start: 100, end: 0, direction: "down" }],
};

// ─── TERMINAL COLORS ─────────────────────────────────────

const color = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
};

function characterColor(name: string): (s: string) => string {
  const palette = [color.cyan, color.magenta, color.yellow, color.green];
  let hash = 0;
  for (const c of name) hash = (hash + c.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length]!;
}

function substitute(text: string): string {
  return text.replace(/\{@?MC\}/g, MC_NAME);
}

// ─── INPUT ───────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function question(q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function promptChoice(options: { text: string }[]): Promise<number> {
  console.log("\n" + color.yellow("  ❯ Your turn:"));
  options.forEach((opt, i) => {
    console.log(`    ${color.dim(`[${i + 1}]`)} ${substitute(opt.text)}`);
  });

  const answer = await question("\n  > ");
  let idx = parseInt(answer.trim(), 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= options.length) {
    console.log(color.dim("  (invalid — defaulting to option 1)"));
    idx = 0;
  }

  const chosen = options[idx]!;
  const paint = characterColor(MC_NAME);
  console.log(`\n  ${paint(color.bold(MC_NAME))}: ${substitute(chosen.text)}`);
  return idx;
}

// ─── MAIN ────────────────────────────────────────────────

async function main() {
  const contentPath = process.argv[2];
  const manifestPath = process.argv[3];
  if (!contentPath || !manifestPath) {
    console.error("Usage: pnpm cli <content.json> <manifest.json>");
    process.exit(1);
  }

  const parsed = StoryFile.safeParse(
    JSON.parse(fs.readFileSync(path.resolve(contentPath), "utf-8")),
  );
  if (!parsed.success) {
    console.error("Content validation failed:");
    console.error(parsed.error.format());
    process.exit(1);
  }
  const content = parsed.data;
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(manifestPath), "utf-8"),
  ) as Manifest;

  // ONE engine for the whole playthrough — state persists across chats.
  const engine = createEngine({
    config: gameConfig,
    onEvent: (event: EngineEvent) => {
      switch (event.type) {
        case "typing_start":
          process.stdout.write(color.dim(`  [${event.character} is typing...]\r`));
          break;
        case "typing_end":
          process.stdout.write("                                      \r");
          break;
        case "message_shown": {
          const text = event.message.text;
          if (text.startsWith("__status__:")) {
            console.log("\n" + color.dim(`── ${substitute(text.slice(11))} ──`) + "\n");
          } else if (text.startsWith("__sticker__:")) {
            console.log(color.dim(`  [sticker: ${text.slice(12)}]`));
          } else if (text.startsWith("__image__:")) {
            console.log(color.dim(`  [image: ${text.slice(10)}]`));
          } else {
            const paint = characterColor(event.message.character);
            console.log(`${paint(color.bold(event.message.character))}: ${substitute(text)}`);
          }
          break;
        }
        case "choice_required":
          promptChoice(event.options).then((index) => engine.chooseOption(index));
          break;
        case "affinity_changed":
          console.log(color.dim(`  [${event.axis}: ${event.value}]`));
          break;
        case "counter_changed":
          console.log(color.dim(`  [${event.counterId}: ${event.value}]`));
          break;
        case "flag_set":
          console.log(color.dim(`  [flag set: ${event.flag}]`));
          break;
        case "segment_complete":
          console.log(color.dim(`\n══ chat complete ══`));
          break;
      }
    },
  });
  engine.setPace(1.0);

  // ─── navigation: days → chats → play ───
  let running = true;
  while (running) {
    const days = listDays(manifest);
    console.log("\n" + color.bold("Days:"));
    days.forEach((d, i) => console.log(`  ${color.dim(`[${i + 1}]`)} Day ${d.day}`));
    const dayAnswer = (await question("\nPick a day (number), or q to quit: ")).trim();
    if (dayAnswer === "q") break;
    const day = days[parseInt(dayAnswer, 10) - 1];
    if (!day) {
      console.log(color.dim("  (invalid day)"));
      continue;
    }

    let inDay = true;
    while (inDay) {
      const threads = listThreads(manifest, day.day);
      if (threads.length === 0) {
        console.log(color.dim("  (no chats on this day)"));
        break;
      }
      console.log("\n" + color.bold(`Day ${day.day} — chats:`));
      threads.forEach((t, i) =>
        console.log(`  ${color.dim(`[${i + 1}]`)} ${t.display_name}`),
      );
      const chatAnswer = (await question("\nPick a chat (number), b for days, q to quit: ")).trim();
      if (chatAnswer === "q") {
        running = false;
        break;
      }
      if (chatAnswer === "b") {
        inDay = false;
        break;
      }
      const thread = threads[parseInt(chatAnswer, 10) - 1];
      if (!thread) {
        console.log(color.dim("  (invalid chat)"));
        continue;
      }

      // gate + assemble against the live, accumulated state, then play.
      const segment = assembleThread(manifest, content, day.day, thread.id, engine.getState());
      console.log("\n" + color.dim(`── ${thread.display_name} ──`));
      engine.loadSegment(segment);
      await engine.play();
      console.log(color.dim(`  candles: ${engine.getState().counters.candles}`));
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
