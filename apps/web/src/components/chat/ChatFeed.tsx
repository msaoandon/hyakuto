"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatBubble } from "./ChatBubble";
import { StatusMessage } from "./StatusMessage";
import { TypingIndicator } from "./TypingIndicator";
import demoData from "@/data/demo.json";

const MC_NAME = "You";

const TIMING = {
  beforeMessage: 1500,
  betweenGrouped: 800,
  beforeChoice: 1200,
  typingDuration: 300,
};

function substitute(text: string): string {
  return text.replace(/\{@?MC\}/g, MC_NAME);
}

type VisibleItem =
  | { kind: "message"; character: string; text: string; isMC: boolean }
  | { kind: "status"; text: string }
  | { kind: "mc-reply"; text: string };

type PendingChoice = {
  options: { text: string }[];
};

type ChatFeedProps = {
  onChoiceAvailable: (choice: PendingChoice) => void;
  onChoiceConsumed: () => void;
  chosenText: string | null;
  onChosenRendered: () => void;
};

export function ChatFeed({
  onChoiceAvailable,
  onChoiceConsumed,
  chosenText,
  onChosenRendered,
}: ChatFeedProps) {
  const [visible, setVisible] = useState<VisibleItem[]>([]);
  const [typingCharacter, setTypingCharacter] = useState<string | null>(null);
  const [waitingForChoice, setWaitingForChoice] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<(() => void) | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // When a choice is made, render MC reply and resume
  useEffect(() => {
    if (chosenText && waitingForChoice) {
      setVisible((prev) => [...prev, { kind: "mc-reply", text: chosenText }]);
      setWaitingForChoice(false);
      onChoiceConsumed();
      onChosenRendered();
      // Resume playback
      if (resumeRef.current) {
        resumeRef.current();
        resumeRef.current = null;
      }
    }
  }, [chosenText, waitingForChoice, onChoiceConsumed, onChosenRendered]);

  useEffect(() => {
    scrollToBottom();
  }, [visible, typingCharacter, scrollToBottom]);

  useEffect(() => {
    let cancelled = false;
    const block = demoData[0];
    const items = block.items;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        if (cancelled) return resolve();
        setTimeout(resolve, ms);
      });

    const addItem = (item: VisibleItem) => {
      if (cancelled) return;
      setVisible((prev) => [...prev, item]);
    };

    const showTyping = async (character: string) => {
      if (cancelled) return;
      setTypingCharacter(character);
      await sleep(TIMING.typingDuration);
      if (!cancelled) setTypingCharacter(null);
    };

    const waitForChoice = (options: { text: string }[]): Promise<void> => {
      return new Promise((resolve) => {
        if (cancelled) return resolve();
        setWaitingForChoice(true);
        onChoiceAvailable({ options: options.map((o) => ({ text: substitute(o.text) })) });
        resumeRef.current = resolve;
      });
    };

    async function playBlock() {
      for (let i = 0; i < items.length; i++) {
        if (cancelled) return;
        const item = items[i];

        switch (item.type) {
          case "status":
            await sleep(TIMING.beforeMessage);
            addItem({ kind: "status", text: substitute(item.text) });
            break;

          case "message": {
            const messages = item.messages;
            const isMC = item.character === "MC";

            for (let m = 0; m < messages.length; m++) {
              if (cancelled) return;
              await sleep(m === 0 ? TIMING.beforeMessage : TIMING.betweenGrouped);
              if (!isMC) {
                await showTyping(item.character);
              }
              addItem({
                kind: "message",
                character: item.character,
                text: substitute(messages[m]),
                isMC,
              });
            }
            break;
          }

          case "choice":
            await sleep(TIMING.beforeChoice);
            await waitForChoice(item.options);
            break;

          case "typing":
            await showTyping(item.character);
            break;
        }
      }
    }

    playBlock();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="min-h-full flex flex-col justify-end gap-1">
        {visible.map((item, i) => {
          switch (item.kind) {
            case "status":
              return <StatusMessage key={i} text={item.text} />;

            case "mc-reply":
              return (
                <div key={i} className="mt-3">
                  <ChatBubble character={MC_NAME} text={item.text} isMC={true} />
                </div>
              );

            case "message": {
              if (item.isMC) {
                return (
                  <div key={i} className="mt-3">
                    <ChatBubble character={MC_NAME} text={item.text} isMC={true} />
                  </div>
                );
              }

              const prev = visible[i - 1];
              const next = visible[i + 1];
              const isFirst =
                !prev || prev.kind !== "message" || prev.character !== item.character || prev.isMC;
              const isLast =
                !next || next.kind !== "message" || next.character !== item.character || next.isMC;

              return (
                <div key={i} className={isFirst && i > 0 ? "mt-3" : ""}>
                  <ChatBubble
                    character={item.character}
                    text={item.text}
                    isMC={false}
                    showName={isFirst}
                    showAvatar={isLast}
                  />
                </div>
              );
            }
          }
        })}
        {typingCharacter && (
          <div className="mt-3">
            <TypingIndicator character={typingCharacter} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
