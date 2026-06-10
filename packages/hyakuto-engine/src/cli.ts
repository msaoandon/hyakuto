import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { StoryFile } from "./schemas/block";
import { createEngine, type EngineEvent, type SegmentInput } from "./engine";
import type { GameConfig } from "./schemas/game-config";
import { DayConfig } from "./schemas/day";

// ─── CONFIG ──────────────────────────────────────────────

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

// ─── CONVERT BLOCK TO SEGMENT ────────────────────────────

function convertBlockToSegment(block: { block_id: string; items: any[] }): SegmentInput {
  const messages: SegmentInput["messages"] = [];
  const choices: Record<
    string,
    { character?: string; options: { text: string; effects?: { axis: string; delta: number }[] }[] }
  > = {};
  let msgIndex = 0;

  for (const item of block.items) {
    if (item.type === "message" && item.messages) {
      for (const text of item.messages) {
        const id = `${block.block_id}_msg_${msgIndex++}`;
        messages.push({
          id,
          character: item.character,
          text,
          condition: item.condition,
          effects: item.effects,
        });
      }
    } else if (item.type === "choice" && item.options) {
      if (messages.length > 0) {
        const lastMsgId = messages[messages.length - 1]!.id;
        choices[lastMsgId] = {
          character: item.character,
          options: item.options.map((opt: any) => ({
            text: opt.text,
            effects: opt.effects,
          })),
        };
      }
    }
  }

  return {
    id: block.block_id,
    messages,
    choices: Object.keys(choices).length > 0 ? choices : undefined,
  };
}

// ─── PROMPT FOR CHOICE ───────────────────────────────────

async function promptChoice(options: { text: string }[]): Promise<number> {
  console.log("\n" + color.yellow("  ❯ Your turn:"));
  options.forEach((opt, i) => {
    console.log(`    ${color.dim(`[${i + 1}]`)} ${substitute(opt.text)}`);
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) => {
    rl.question("\n  > ", (a) => {
      rl.close();
      resolve(a);
    });
  });

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
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: pnpm cli <story-file.json>");
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(filePath), "utf-8");
  const parsed = JSON.parse(raw);
  const result = StoryFile.safeParse(parsed);

  if (!result.success) {
    console.error("Validation failed:");
    console.error(result.error.format());
    process.exit(1);
  }

  const blocks = result.data;
  let pendingChoiceResolve: ((index: number) => void) | null = null;

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
          const paint = characterColor(event.message.character);
          const sender = paint(color.bold(event.message.character));
          console.log(`${sender}: ${substitute(event.message.text)}`);
          break;
        }

        case "choice_required":
          promptChoice(event.options).then((index) => {
            engine.chooseOption(index);
          });
          break;

        case "affinity_changed":
          console.log(color.dim(`  [${event.axis}: ${event.value}]`));
          break;

        case "flag_set":
          console.log(color.dim(`  [flag set: ${event.flag}]`));
          break;

        case "segment_complete":
          console.log(color.dim(`\n══ segment complete: ${event.segmentId} ══`));
          break;
        case "segment_start": {
          const b = blockById[event.segmentId];
          if (b)
            for (const item of b.items) {
              if (item.type === "status")
                console.log("\n" + color.dim(`── ${substitute(item.text)} ──`) + "\n");
            }
          break;
        }
        case "day_complete":
          console.log(color.dim(`\n══ day complete ══`));
          console.log(color.dim(`  state: ${JSON.stringify(engine.getState().axes)}`));
          break;
      }
    },
  });

  engine.setPace(1.0);

  // build a day from the blocks
  const day: DayConfig = { day: 1, route: "cli", segments: blocks.map((b) => b.block_id) };
  const segmentsById: Record<string, SegmentInput> = {};
  const blockById: Record<string, (typeof blocks)[number]> = {};
  for (const b of blocks) {
    segmentsById[b.block_id] = convertBlockToSegment(b);
    blockById[b.block_id] = b;
  }

  engine.setPace(1.0);
  engine.loadDay(day, segmentsById);
  await engine.playDay();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
