import * as fs from 'fs';
import * as path from 'path';
import { gameConfig } from '@hyakuto/game';
import { mergeBlocks, validateBlocks } from './validate';

const dir = path.resolve(process.argv[2] ?? 'content');

function globJson(d: string): string[] {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const full = path.join(d, e.name);
    return e.isDirectory() ? globJson(full) : e.name.endsWith('.json') ? [full] : [];
  });
}

const sources = globJson(dir).map(p => ({ path: p, data: JSON.parse(fs.readFileSync(p, 'utf-8')) }));
const { pool, errors: merge } = mergeBlocks(sources);
const all = [...merge, ...validateBlocks(pool, gameConfig)];

if (all.length) {
  console.error(`\n✗ ${all.length} content error(s):\n`);
  for (const e of all) console.error(`  [${e.source}${e.segmentId ? ` · ${e.segmentId}` : ''}] ${e.message}`);
  process.exit(1);
}
console.log(`✓ ${pool.size} segments validated, no errors.`);
