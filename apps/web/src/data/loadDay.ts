import type { Block, StoryFile, SegmentInput, DayConfig } from "@hyakuto/engine";
import manifestData from "./manifest.json";
import demoData from "./demo.json";

// Segment envelope as produced by the Apps Script exporter's manifest
export type SegmentMeta = {
  id: string;
  type: "group_chat" | "dm" | "vn" | "system";
  route?: string;
  day?: number;
  thread_id?: string;
  scene?: string;
  condition?: string;
};

export type Manifest = {
  days: DayConfig[];
  segments: Record<string, SegmentMeta>;
  threads: Record<string, { display_name: string }>;
};

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
  const day = manifest.days.find((d) => d.day === dayNumber && (route ? d.route === route : true));
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
  const messages: SegmentInput["messages"] = [];
  const choices: Record<
    string,
    { character?: string; options: { text: string; effects?: { axis: string; delta: number }[] }[] }
  > = {};

  let msgIndex = 0;

  for (const item of block.items) {
    switch (item.type) {
      case "cue": {
        messages.push({
          id: `${block.block_id}_cue_${msgIndex++}`,
          character: "",
          kind: "cue",
          channel: item.channel,
          value: item.value,
          condition: item.condition,
        });
        break;
      }

      case "message": {
        if (item.messages) {
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
        }
        break;
      }
      case "sticker": {
        const id = `${block.block_id}_sticker_${msgIndex++}`;
        messages.push({
          id,
          character: item.character,
          text: `__sticker__:${item.file}`,
          condition: item.condition,
        });
        break;
      }
      case "image": {
        const id = `${block.block_id}_image_${msgIndex++}`;
        messages.push({
          id,
          character: item.character,
          text: `__image__:${item.file}`,
          condition: item.condition,
        });
        break;
      }
      case "choice": {
        // Attach choice to the last message
        if (messages.length > 0 && item.options) {
          const lastMsgId = messages[messages.length - 1]!.id;
          choices[lastMsgId] = {
            character: "character" in item ? item.character : undefined,
            options: item.options.map((opt) => ({
              text: opt.text,
              effects: opt.effects,
            })),
          };
        }
        break;
      }
      case "pool": {
        if ("variants" in item) {
          const id = `${block.block_id}_pool_${msgIndex++}`;
          messages.push({
            id,
            character: item.character,
            pool: item.variants.map((v, i) => ({
              idx: i,
              text: v.text,
              weight: v.weight ?? 1,
            })),
            condition: item.condition,
            effects: item.effects,
          });
        }
        break;
      }
      case "status": {
        messages.push({
          id: `${block.block_id}_status_${msgIndex++}`,
          character: "",
          text: `__status__:${item.text}`,
          delay_ms: 0,
          typing_ms: 0, // ← no typing indicator (engine skips when <= 0)
          condition: item.condition,
        });
        break;
      }
      // typing items bypass the engine for now
    }
  }

  return {
    id: block.block_id,
    messages,
    choices: Object.keys(choices).length > 0 ? choices : undefined,
  };
}

const manifest = manifestData as Manifest;
const content = demoData as StoryFile;

export function assembleThread(day: number, threadId: string): SegmentInput {
  const dayCfg = manifest.days.find((d) => d.day === day);
  const segmentIds = (dayCfg?.segments ?? []).filter(
    (id) => manifest.segments[id]?.thread_id === threadId,
  );

  const blockById: Record<string, Block> = {};
  for (const b of content) blockById[b.block_id] = b;

  const segs = segmentIds
    .map((id) => blockById[id])
    .filter((b): b is Block => Boolean(b))
    .map(convertBlockToSegment);

  return {
    id: `${day}:${threadId}`,
    messages: segs.flatMap((s) => s.messages),
    choices: Object.assign({}, ...segs.map((s) => s.choices ?? {})),
  };
}
