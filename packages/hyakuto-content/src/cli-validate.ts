import * as fs from 'fs';
import * as path from 'path';
import { gameConfig, sceneDesigns } from '@hyakuto/game';
import { mergeBlocks, validateBlocks, validateManifest, isManifest } from './validate';

const dir = path.resolve(process.argv[2] ?? 'content');

function globJson(d: string): string[] {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const full = path.join(d, e.name);
    return e.isDirectory() ? globJson(full) : e.name.endsWith('.json') ? [full] : [];
  });
}

const sources = globJson(dir).map(p => ({ path: p, data: JSON.parse(fs.readFileSync(p, 'utf-8')) }));
// Manifest files carry the `{ days, segments, threads }` envelope; everything else is blocks.
const manifests = sources.filter(s => isManifest(s.data));
const blockSources = sources.filter(s => !isManifest(s.data));

const { pool, errors: merge } = mergeBlocks(blockSources);
const all = [...merge, ...validateBlocks(pool, gameConfig, Object.keys(sceneDesigns))];
for (const m of manifests) all.push(...validateManifest(pool, m.data, m.path));

if (all.length) {
  console.error(`\n✗ ${all.length} content error(s):\n`);
  for (const e of all) console.error(`  [${e.source}${e.segmentId ? ` · ${e.segmentId}` : ''}] ${e.message}`);
  process.exit(1);
}
console.log(`✓ ${pool.size} segments validated, no errors.`);
