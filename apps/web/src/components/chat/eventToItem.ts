import type { QueuedMessage } from "@hyakuto/engine";
import type { VisibleItem } from "./types";
import { substituteMC } from "./mc";

// Authoring encodes non-text content as text prefixes on a normal message.
const STATUS = "__status__:";
const STICKER = "__sticker__:";
const IMAGE = "__image__:";

/** Map a shown engine message to a renderable feed item. */
export function messageToItem(message: QueuedMessage): VisibleItem {
  const { character, text } = message;

  if (text.startsWith(STATUS)) {
    return { kind: "status", text: substituteMC(text.slice(STATUS.length)) };
  }
  if (text.startsWith(STICKER)) {
    return { kind: "sticker", character, file: text.slice(STICKER.length) };
  }
  if (text.startsWith(IMAGE)) {
    return { kind: "image", character, file: text.slice(IMAGE.length) };
  }
  return {
    kind: "message",
    character,
    text: substituteMC(text),
    isMC: character === "MC",
    isDev: character === "dev",
  };
}
