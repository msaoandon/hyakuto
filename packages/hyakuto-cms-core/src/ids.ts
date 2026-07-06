// ─── MANAGED IDS (§III.2) ─────────────────────────────────────────────────────
// Stable, position/text-independent ids, assigned by the CMS — authors never type
// them. Human-readable-ish (`d1_oiwa_dm`, `d1_intro__3`), derived once at creation
// and never recomputed from order or wording, so reorder/reword is always safe.
//
// Line/child numbering continues from the highest number present (importer emits
// 0-based `__0…__n`, `__o0`, `__v0`), so live rows never collide. Explicit
// tradeoff: deleting the highest-numbered row lets its number be minted again —
// a translation-import hazard only for strings that no longer exist, which the
// stale-locale flags absorb. Colliding with *live* content is impossible without
// persisting a counter on every entity (a schema bump); not worth it yet.

/** An author-facing name → a content id slug (underscores — content ids appear in
 *  conditions, where `-` reads as arithmetic). Diacritics folded, never empty. */
export function slugifyId(text: string, fallback = 'item'): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || fallback;
}

/** Dedupe a base id against everything already taken: `base`, `base_2`, `base_3`… */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// Highest numeric suffix following `prefix` among `ids` (-1 when none), so the
// next mint is always past every number ever seen in the current entity.
function maxSuffix(prefix: string, ids: Iterable<string>): number {
  let max = -1;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const digits = /^(\d+)/.exec(id.slice(prefix.length));
    if (digits) max = Math.max(max, Number(digits[1]));
  }
  return max;
}

/** Next line id within a segment: `<segmentId>__<n>` (importer-compatible). */
export function nextLineId(segmentId: string, lineIds: Iterable<string>): string {
  return `${segmentId}__${maxSuffix(`${segmentId}__`, lineIds) + 1}`;
}

/** Next choice-option (`o`) or pool-variant (`v`) id under a line:
 *  `<lineId>__o<n>` / `<lineId>__v<n>` (importer-compatible). */
export function nextChildId(lineId: string, kind: 'o' | 'v', childIds: Iterable<string>): string {
  return `${lineId}__${kind}${maxSuffix(`${lineId}__${kind}`, childIds) + 1}`;
}
