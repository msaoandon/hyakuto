// Scans public/music/<theme>/ and writes src/data/musicIndex.json:
//   { "<theme>": ["track_a.mp3", "track_b.mp3"], ... }
// The browser can't list folders at runtime, so the AudioProvider reads this
// generated index to resolve a theme → its tracks. Re-run on dev/build.
import { readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url))); // apps/web
const musicDir = join(root, "public", "music");
const outFile = join(root, "src", "data", "musicIndex.json");

const AUDIO = /\.(mp3|ogg|wav|m4a|aac)$/i;
const index = {};

for (const entry of readdirSync(musicDir)) {
  const dir = join(musicDir, entry);
  if (!statSync(dir).isDirectory()) continue;
  const tracks = readdirSync(dir).filter((f) => AUDIO.test(f)).sort();
  if (tracks.length) index[entry] = tracks;
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(index, null, 2) + "\n");
console.log(`music index: ${Object.keys(index).length} themes → ${outFile}`);
