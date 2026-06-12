// components/chat/ChatFeed.tsx
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ChatBubble } from "./ChatBubble";
import { StatusMessage } from "./StatusMessage";
import { TypingIndicator } from "./TypingIndicator";
import { createEngine, type EngineEvent, type SegmentInput, type StoryFile } from "@hyakuto/engine";
import type { Block, GameConfig } from "@hyakuto/engine";
import demoData from "@/data/demo.json";
import { convertBlockToSegment } from "@/data/loadDay";
import { gameConfig } from "@hyakuto/game";
import { groupItems } from "./groupMessages";
import type { VisibleItem } from "./types";

const MC_NAME = "You";

function snapshot(engine: ReturnType<typeof createEngine>) {
  const s = engine.getState();
  return { axes: { ...s.axes }, counters: { ...s.counters }, flags: Array.from(s.flags) };
}

// ─── TYPES ───────────────────────────────────────────────

type PendingChoice = {
  options: { text: string }[];
  character?: string;
  onEngineReady?: (api: { getCounterStart: (id: string) => number; advance: () => void }) => void;
  onSegmentEnded?: (hasNext: boolean) => void;
};

type ChatFeedProps = {
  onChoiceAvailable: (choice: PendingChoice) => void;
  onChoiceConsumed: () => void;
  chosenText: string | null;
  onChosenRendered: () => void;
  onStateChange?: (state: {
    axes: Record<string, number>;
    counters: Record<string, number>;
    flags: string[];
  }) => void;
  onEngineEvent?: (event: string) => void;
  onEngineReady?: (api: { getCounterStart: (id: string) => number; advance: () => void }) => void;
  onSegmentEnded?: (hasNext: boolean) => void;
  onImageTap?: (file: string) => void;
};

// ─── COMPONENT ───────────────────────────────────────────

export function ChatFeed({
  onChoiceAvailable,
  onChoiceConsumed,
  chosenText,
  onChosenRendered,
  onStateChange,
  onEngineEvent,
  onEngineReady,
  onSegmentEnded,
  onImageTap,
}: ChatFeedProps) {
  const [visible, setVisible] = useState<VisibleItem[]>([]);
  const [typingCharacter, setTypingCharacter] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
  const indexRef = useRef(0);
  const choiceResolveRef = useRef<((index: number) => void) | null>(null);
  const pendingOptionsRef = useRef<{ text: string }[]>([]);
  const pendingCharacterRef = useRef<string | undefined>(undefined);
  const blocks = demoData as StoryFile;
  const block = blocks[0]!;

  // Handle choice selection
  useEffect(() => {
    if (chosenText && pendingOptionsRef.current.length > 0) {
      const index = pendingOptionsRef.current.findIndex((o) => o.text === chosenText);
      if (index >= 0) {
        const isDev = pendingCharacterRef.current === "dev";
        setVisible((prev) => [
          ...prev,
          {
            kind: "mc-reply" as const,
            text: chosenText,
            isDev,
          },
        ]);

        try {
          engineRef.current?.chooseOption(index);
        } catch {}

        pendingOptionsRef.current = [];
        pendingCharacterRef.current = undefined;
        onChoiceConsumed();
        onChosenRendered();
      }
    }
  }, [chosenText, onChoiceConsumed, onChosenRendered]);

  // Start engine playback — steps through blocks on advance()
  useEffect(() => {
    let cancelled = false;

    const engine = createEngine({
      config: gameConfig,
      onEvent: (event: EngineEvent) => {
        if (cancelled) return;
        switch (event.type) {
          case "cue":
            onEngineEvent?.(`cue: ${event.channel} = ${event.value}`);
            break;
          case "typing_start":
            if (event.character !== "MC") setTypingCharacter(event.character);
            break;
          case "typing_end":
            setTypingCharacter(null);
            break;
          case "message_shown": {
            const isMC = event.message.character === "MC";
            const isDev = event.message.character === "dev";
            const text = event.message.text;
            if (text.startsWith("__sticker__:")) {
              setVisible((prev) => [
                ...prev,
                {
                  kind: "sticker" as const,
                  character: event.message.character,
                  file: text.replace("__sticker__:", ""),
                },
              ]);
            } else if (text.startsWith("__image__:")) {
              setVisible((prev) => [
                ...prev,
                {
                  kind: "image" as const,
                  character: event.message.character,
                  file: text.replace("__image__:", ""),
                },
              ]);
            } else {
              setVisible((prev) => [
                ...prev,
                {
                  kind: "message" as const,
                  character: event.message.character,
                  text: text.replace(/\{@?MC\}/g, MC_NAME),
                  isMC,
                  isDev,
                },
              ]);
            }
            break;
          }
          case "choice_required": {
            const substituted = event.options.map((o) => ({
              ...o,
              text: o.text.replace(/\{@?MC\}/g, MC_NAME),
            }));
            pendingOptionsRef.current = substituted;
            pendingCharacterRef.current = event.character;
            onChoiceAvailable({ options: substituted, character: event.character });
            break;
          }
          case "affinity_changed":
            onStateChange?.(snapshot(engine));
            onEngineEvent?.(`${event.axis} → ${event.value}`);
            break;
          case "counter_changed":
            onStateChange?.(snapshot(engine));
            onEngineEvent?.(`${event.counterId} → ${event.value}`);
            break;
          case "flag_set":
            onStateChange?.(snapshot(engine));
            onEngineEvent?.(`flag: ${event.flag}`);
            break;
          case "segment_complete": {
            onEngineEvent?.(`segment complete: ${event.segmentId}`);
            onSegmentEnded?.(indexRef.current + 1 < blocks.length);
            break;
          }
        }
      },
    });

    engineRef.current = engine;
    engine.setPace(1.0);

    const runBlock = async (b: Block) => {
      for (const item of b.items) {
        if (item.type === "status") {
          setVisible((prev) => [
            ...prev,
            { kind: "status" as const, text: item.text.replace(/\{@?MC\}/g, MC_NAME) },
          ]);
        }
      }
      engine.loadSegment(convertBlockToSegment(b));
      onStateChange?.(snapshot(engine));
      await engine.play();
    };

    const advance = () => {
      const next = indexRef.current + 1;
      if (next >= blocks.length) return;
      indexRef.current = next;
      runBlock(blocks[next]!);
    };

    onEngineReady?.({ getCounterStart: engine.getCounterStart, advance });

    onStateChange?.(snapshot(engine));
    runBlock(blocks[0]!);

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => groupItems(visible), [visible]);

  return (
    <div className="flex-1 overflow-y-auto flex flex-col-reverse p-4 chat-bg">
      <div className="flex flex-col gap-1 pb-4">
        {grouped.map((item, i) => {
          switch (item.kind) {
            case "status":
              return <StatusMessage key={item.index} text={item.text} />;

            case "mc-reply":
              return (
                <div key={item.index} className="mt-3">
                  <ChatBubble
                    character={item.isDev ? "dev" : MC_NAME}
                    text={item.text}
                    isMC={!item.isDev}
                    isDev={item.isDev}
                  />
                </div>
              );

            case "group": {
              const { group } = item;
              const isLastGroup = i === grouped.length - 1;
              const continuesWithTyping = isLastGroup && typingCharacter === group.character;
              return (
                <div key={group.messages[0].index} className={i > 0 ? "mt-3" : ""}>
                  {group.messages.map((msg, mi) => {
                    const isFirst = mi === 0;
                    const isLast = mi === group.messages.length - 1;
                    return (
                      <ChatBubble
                        key={msg.index}
                        character={group.character}
                        text={msg.text}
                        isMC={false}
                        showName={mi === 0}
                        showAvatar={isLast && !continuesWithTyping}
                        isFirst={isFirst}
                        isLast={isLast}
                        contentType={msg.kind as "message" | "sticker" | "image" | undefined}
                        file={msg.file!}
                        onImageTap={onImageTap}
                      />
                    );
                  })}
                </div>
              );
            }
          }
        })}
        {typingCharacter &&
          (() => {
            const last = visible[visible.length - 1];
            const sameCharacter =
              last?.kind === "message" &&
              !last.isMC &&
              !last.isDev &&
              last.character === typingCharacter;
            return (
              <div className={sameCharacter ? "" : "mt-3"}>
                <TypingIndicator character={typingCharacter} showAvatar={!sameCharacter} />
              </div>
            );
          })()}
      </div>
    </div>
  );
}
