import type { Block, StoryFile, SegmentInput, DayConfig } from "@hyakuto/engine";

// Segment envelope as produced by the Apps Script exporter's manifest
export type SegmentMeta = {
  id: string;
  type: "group_chat" | "dm" | "vn" | "system";
  route?: string;
  day?: number;
  thread_id?: string;
  scene?: string;
  condition?: string;
  characters_present?: string[];
};

export type Manifest = { days: DayConfig[]; segments: Record<string, SegmentMeta> };

export type LoadedDay = {
  day: DayConfig;
  segmentsById: Record<string, SegmentInput>;
  meta: Record<string, SegmentMeta>;
};

export function buildDay(
  manifest: Manifest,
  content: StoryFile,
  dayNumber: number,
  route?: string,
): LoadedDay {
  const day = manifest.days.find(
    (d) => d.day === dayNumber && (route ? d.route === route : true),
  );
  if (!day) throw new Error(`Manifest has no day ${dayNumber}`);

  const blockById: Record<string, Block> = {};
  for (const b of content) blockById[b.block_id] = b;

  const segmentsById: Record<string, SegmentInput> = {};
  for (const id of day.segments) {
    const block = blockById[id];
    if (!block) throw new Error(`Day ${dayNumber} references missing block "${id}"`);
    const seg = convertBlockToSegment(block);
    seg.condition = manifest.segments[id]?.condition; // ← attach the gate from the manifest
    segmentsById[id] = seg;
  }

  return { day, segmentsById, meta: manifest.segments };
}

// moved verbatim from ChatFeed.tsx — now the single shared copy
export function convertBlockToSegment(block: Block): SegmentInput {
  /* …paste the existing body from ChatFeed.tsx:21-119… */
}
