import type { VisibleItem } from "../types";

export type MessageGroup = {
  character: string;
  isMC: boolean;
  isDev: boolean;
  messages: { text: string; index: number; kind?: string; file?: string }[];
};

export type GroupedItem =
  | { kind: "status"; text: string; index: number }
  | { kind: "mc-reply"; text: string; isDev: boolean; index: number }
  | { kind: "group"; group: MessageGroup };

export function groupItems(items: VisibleItem[]): GroupedItem[] {
  const result: GroupedItem[] = [];
  let currentGroup: MessageGroup | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.kind === "status") {
      if (currentGroup) {
        result.push({ kind: "group", group: currentGroup });
        currentGroup = null;
      }
      result.push({ kind: "status", text: item.text, index: i });
      continue;
    }

    if (item.kind === "mc-reply") {
      if (currentGroup) {
        result.push({ kind: "group", group: currentGroup });
        currentGroup = null;
      }
      result.push({ kind: "mc-reply", text: item.text, isDev: item.isDev, index: i });
      continue;
    }

    if (item.kind === "message") {
      if (item.isMC || item.isDev) {
        if (currentGroup) {
          result.push({ kind: "group", group: currentGroup });
          currentGroup = null;
        }
        result.push({ kind: "mc-reply", text: item.text, isDev: item.isDev, index: i });
        continue;
      }

      if (currentGroup && currentGroup.character === item.character) {
        currentGroup.messages.push({ text: item.text, index: i });
      } else {
        if (currentGroup) {
          result.push({ kind: "group", group: currentGroup });
        }
        currentGroup = {
          character: item.character,
          isMC: false,
          isDev: false,
          messages: [{ text: item.text, index: i }],
        };
      }
    }

    if (item.kind === "sticker" || item.kind === "image") {
      if (currentGroup && currentGroup.character === item.character) {
        currentGroup.messages.push({ text: "", index: i, kind: item.kind, file: item.file });
      } else {
        if (currentGroup) {
          result.push({ kind: "group", group: currentGroup });
        }
        currentGroup = {
          character: item.character,
          isMC: false,
          isDev: false,
          messages: [{ text: "", index: i, kind: item.kind, file: item.file }],
        };
      }
      continue;
    }
  }

  if (currentGroup) {
    result.push({ kind: "group", group: currentGroup });
  }

  return result;
}
