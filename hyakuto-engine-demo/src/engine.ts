import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { StoryFile, Block, BlockItem, Effect } from './schema.js';

// ─── CONFIG ──────────────────────────────────────────────────

const MC_NAME = 'You';

// Timing tuned for "feels like a chat app" without being painful in tests.
// Bump these up later for real playthroughs.
const TIMING = {
  beforeMessage: 1500,    // pause before typing indicator appears
  betweenGrouped: 800,   // gap between consecutive messages in a group
  beforeChoice: 1200,
};

// ─── UTILITIES ───────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const color = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
};

// Substitute {MC} and {@MC} placeholders.
// {@MC} is the "addressed" form — same substitution for now, the
// engine spec leaves room for it to mean something different later.
function substitute(text: string): string {
  return text.replace(/\{@?MC\}/g, MC_NAME);
}

// Per-character color so the transcript is scannable.
// Hash the name to a stable color so new characters auto-assign.
function characterColor(name: string): (s: string) => string {
  const palette = [color.cyan, color.magenta, color.yellow, color.green];
  let hash = 0;
  for (const c of name) hash = (hash + c.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length]!;
}

// ─── LOADING & VALIDATION ────────────────────────────────────

function loadStory(filePath: string): StoryFile {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);

  const result = StoryFile.safeParse(parsed);
  if (!result.success) {
    console.error('Story validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

// ─── DISPLAY ─────────────────────────────────────────────────

async function displayStatus(item: Extract<BlockItem, { type: 'status' }>) {
  const text = substitute(item.text);
  console.log('\n' + color.dim(`── ${text} ──`) + '\n');
}

async function displayMessageGroup(item: Extract<BlockItem, { type: 'message' }>) {
  const paint = characterColor(item.character);
  const sender = paint(color.bold(item.character));

  for (let i = 0; i < item.messages.length; i++) {
    const text = substitute(item.messages[i]!);
    await sleep(i === 0 ? TIMING.beforeMessage : TIMING.betweenGrouped);
    console.log(`${sender}: ${text}`);
  }

  if (item.effects?.length) {
    console.log('  ' + color.dim(formatEffects(item.effects)));
  }
}

function formatEffects(effects: Effect[]): string {
  return effects
    .map(e => `${e.delta >= 0 ? '+' : ''}${e.delta} ${e.axis}`)
    .join(', ');
}

// ─── CHOICE HANDLING ─────────────────────────────────────────

async function presentChoice(
  item: Extract<BlockItem, { type: 'choice' }>,
  state: GameState
): Promise<void> {
  await sleep(TIMING.beforeChoice);
  console.log('\n' + color.yellow('  ❯ Your turn:'));

  item.options.forEach((opt, i) => {
    const text = substitute(opt.text);
    const effectHint = opt.effects?.length
      ? color.dim(`  (${formatEffects(opt.effects)})`)
      : '';
    console.log(`    ${color.dim(`[${i + 1}]`)} ${text}${effectHint}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer: string = await new Promise(resolve => {
    rl.question('\n  > ', (a) => {
      rl.close();
      resolve(a);
    });
  });

  let idx = parseInt(answer.trim(), 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= item.options.length) {
    console.log(color.dim('  (invalid input — defaulting to option 1)'));
    idx = 0;
  }

  const chosen = item.options[idx]!;
  const chosenText = substitute(chosen.text);

  // Echo MC's choice as a message in the transcript
  const mcPaint = characterColor(MC_NAME);
  console.log(`\n  ${mcPaint(color.bold(MC_NAME))}: ${chosenText}`);

  // Apply effects to game state
  if (chosen.effects?.length) {
    applyEffects(state, chosen.effects);
    console.log('  ' + color.dim(formatEffects(chosen.effects)));
  }
}

// ─── GAME STATE ──────────────────────────────────────────────

// Minimal state for the prototype: just the affinity/counter axes.
// Expands later when the real engine arrives.
type GameState = {
  axes: Record<string, number>;
};

function newGameState(): GameState {
  return { axes: {} };
}

function applyEffects(state: GameState, effects: Effect[]) {
  for (const eff of effects) {
    state.axes[eff.axis] = (state.axes[eff.axis] ?? 0) + eff.delta;
  }
}

// ─── THE ENGINE LOOP ─────────────────────────────────────────

async function playBlock(block: Block, state: GameState) {
  console.log(color.dim(`\n══ block: ${block.block_id} ══`));

  for (const item of block.items) {
    // Conditions are passed through but not yet evaluated.
    // The real engine has a boolean expression parser; we just log here.
    if ('condition' in item && item.condition) {
      console.log(color.dim(`  [condition: ${item.condition}]`));
    }

    switch (item.type) {
      case 'status':
        await displayStatus(item);
        break;
      case 'message':
        await displayMessageGroup(item);
        break;
      case 'choice':
        await presentChoice(item, state);
        break;
      case 'typing':
        console.log(color.dim(`  [${item.character} is typing...]`));
        break;
    }
  }

  console.log(color.dim(`\n══ end of block ══`));
  console.log(color.dim(`  state: ${JSON.stringify(state.axes)}\n`));
}

// ─── ENTRY POINT ─────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2];
  const blockIdArg = process.argv[3];

  if (!filePath) {
    console.error('Usage: ts-node src/engine.ts <story-file.json> [block_id]');
    process.exit(1);
  }

  const story = loadStory(path.resolve(filePath));

  const blocks = blockIdArg
    ? story.filter(b => b.block_id === blockIdArg)
    : story;

  if (blocks.length === 0) {
    console.error(`No block with id "${blockIdArg}" found.`);
    process.exit(1);
  }

  const state = newGameState();
  for (const block of blocks) {
    await playBlock(block, state);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
