import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as readline from 'readline';
import { StoryFile, DialogueItemNode } from './schema.js';

// ─── UTILITIES ───────────────────────────────────────────────

// sleep() is the engine's clock. Everything that feels "realtime"
// is just this function being awaited.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ANSI escape codes for terminal styling.
// These are the only "UI" we have in Node.js CLI.
const color = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  reset: '\x1b[0m',
};

// ─── LOADING & VALIDATION ─────────────────────────────────────

function loadStory(filePath: string): StoryFile {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw); // js-yaml returns 'unknown'

  // Zod validates AND narrows the type in one step.
  // If this throws, the story file is malformed — fail loudly.
  const result = StoryFile.safeParse(parsed);
  if (!result.success) {
    console.error('Story validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

// ─── NODE LOOKUP ──────────────────────────────────────────────

// Build a Map for O(1) node lookup by id.
// This is why every node has an id — the engine navigates by id,
// not by array index. Branching requires jumping to arbitrary nodes.
function buildNodeMap(messages: DialogueItemNode[]): Map<string, DialogueItemNode> {
  const map = new Map<string, DialogueItemNode>();
  for (const node of messages) {
    map.set(node.id, node);
  }
  return map;
}

// Given a node, find what comes next in the linear array.
// This is the "default flow" when no explicit 'next' is set.
function getArraySuccessor(
  node: DialogueItemNode,
  messages: DialogueItemNode[]
): DialogueItemNode | null {
  const idx = messages.findIndex(m => m.id === node.id);
  return messages[idx + 1] ?? null;
}

// ─── DISPLAY ──────────────────────────────────────────────────

async function displayMessage(node: Extract<DialogueItemNode, { character: string }>) {
  // Simulate the delay before typing starts
  if (node.delay_ms > 0) {
    await sleep(node.delay_ms);
  }

  // Show typing indicator
  process.stdout.write(color.dim(`  ${node.character} is typing...`));

  await sleep(node.typing_ms);

  // Clear the typing indicator (move cursor to line start, clear line)
  process.stdout.write('\r\x1b[K');

  // Print the message
  const sender = color.cyan(color.bold(node.character));
  console.log(`${sender}: ${node.text}`);
}

// ─── CHOICE HANDLING ─────────────────────────────────────────

async function presentChoice(
  node: Extract<DialogueItemNode, { type: 'choice' }>
): Promise<string> {
  console.log('\n' + color.yellow(`❯ ${node.prompt}`));

  node.options.forEach((opt, i) => {
    console.log(`  ${color.dim(`[${i + 1}]`)} ${opt.text}`);
  });

  // readline is Node's built-in way to read user input from stdin.
  // We create it, read ONE line, then immediately close it.
  // Why close it? Leaving readline open keeps the process alive.
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question('\n  Your choice: ', (answer) => {
      rl.close();
      const idx = parseInt(answer.trim(), 10) - 1;
      const chosen = node.options[idx];

      if (!chosen) {
        // Invalid input — default to first option
        console.log(color.dim('  (invalid input — defaulting to option 1)'));
        const fallback = node.options[0];
        if(!fallback) {
            rl.close();
            resolve('');
            return;
        }
        resolve(fallback.next);
      } else {
        resolve(chosen.next);
      }
    });
  });
}

// ─── THE ENGINE LOOP ─────────────────────────────────────────

// This is the state machine. It runs until there are no more nodes.
// State: { currentNodeId }
// The map + array give us everything else.
async function run(story: StoryFile) {
  console.log(color.dim(`\n── ${story.segment} ──\n`));

  const nodeMap = buildNodeMap(story.messages);
  let current: DialogueItemNode | null = story.messages[0] ?? null; // start at the top

  while (current !== null) {
    if (current.type === 'choice') {
      // CHOICE: pause, get input, jump to the chosen branch
      const nextId = await presentChoice(current);
      current = nodeMap.get(nextId) ?? null;
    } else {
      // DIALOGUE: display and advance
      await displayMessage(current);

      // Explicit 'next' overrides array order
      if ('next' in current && current.next) {
        current = nodeMap.get(current.next) ?? null;
      } else {
        current = getArraySuccessor(current, story.messages);
      }
    }
  }

  console.log(color.dim('\n── end of segment ──\n'));
}

// ─── ENTRY POINT ─────────────────────────────────────────────

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: ts-node src/engine.ts <story-file.yaml>');
  process.exit(1);
}

const story = loadStory(path.resolve(filePath));
run(story).catch(console.error);