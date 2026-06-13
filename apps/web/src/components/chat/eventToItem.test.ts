import { describe, it, expect } from "vitest";
import { messageToItem } from "./eventToItem";
import type { QueuedMessage } from "@hyakuto/engine";

const msg = (over: Partial<QueuedMessage>): QueuedMessage => ({
  id: "m1",
  character: "ren",
  text: "",
  delay_ms: 0,
  typing_ms: 0,
  ...over,
});

describe("messageToItem", () => {
  it("maps a __status__ prefix to a status item and substitutes {MC}", () => {
    expect(messageToItem(msg({ text: "__status__:{MC} entered the chat" }))).toEqual({
      kind: "status",
      text: "You entered the chat",
    });
  });

  it("maps a __sticker__ prefix to a sticker item keeping the file untouched", () => {
    expect(messageToItem(msg({ character: "kou", text: "__sticker__:wink.png" }))).toEqual({
      kind: "sticker",
      character: "kou",
      file: "wink.png",
    });
  });

  it("maps an __image__ prefix to an image item", () => {
    expect(messageToItem(msg({ character: "kou", text: "__image__:kojiki1.jpg" }))).toEqual({
      kind: "image",
      character: "kou",
      file: "kojiki1.jpg",
    });
  });

  it("maps plain text to a message item and substitutes {@MC}", () => {
    expect(messageToItem(msg({ character: "ren", text: "hey {@MC}!" }))).toEqual({
      kind: "message",
      character: "ren",
      text: "hey You!",
      isMC: false,
      isDev: false,
    });
  });

  it("flags MC and dev senders", () => {
    expect(messageToItem(msg({ character: "MC", text: "hi" }))).toMatchObject({ isMC: true });
    expect(messageToItem(msg({ character: "dev", text: "hi" }))).toMatchObject({ isDev: true });
  });
});
