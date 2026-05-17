// components/chat/ChatFeed.tsx
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ChatBubble } from "./ChatBubble";
import { StatusMessage } from "./StatusMessage";
import { TypingIndicator } from "./TypingIndicator";
import { createEngine, type EngineEvent, type SegmentInput, type StoryFile } from "@hyakuto/engine";
import type { Block, GameConfig } from "@hyakuto/engine";
import demoData from "@/data/demo_3.json";
import { gameConfig } from "@hyakuto/game";
import { groupItems } from "./groupMessages";
import type { VisibleItem } from "./types";

const MC_NAME = "You";

// ─── CONVERT DEMO JSON TO SEGMENT INPUT ──────────────────
// Bridge between your current JSON format and the engine's SegmentInput.
// This adapter disappears when the Apps Script exporter outputs the engine format directly.

function convertBlockToSegment(block: Block): SegmentInput {
  const messages: SegmentInput["messages"] = [];
  const choices: Record<
    string,
    { character?: string; options: { text: string; effects?: { axis: string; delta: number }[] }[] }
  > = {};

  let msgIndex = 0;

  for (const item of block.items) {
    switch (item.type) {
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
      // status and typing items bypass the engine for now
    }
  }

  return {
    id: block.block_id,
    messages,
    choices: Object.keys(choices).length > 0 ? choices : undefined,
  };
}

// ─── TYPES ───────────────────────────────────────────────

type PendingChoice = {
  options: { text: string }[];
  character?: string;
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
  onEngineReady?: (engine: { getCounterStart: (id: string) => number }) => void;
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
}: ChatFeedProps) {
  const [visible, setVisible] = useState<VisibleItem[]>([]);
  const [typingCharacter, setTypingCharacter] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
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

  // Start engine playback
  useEffect(() => {
    let cancelled = false;

    // Add any status items before engine starts
    for (const item of block.items) {
      if (item.type === "status") {
        setVisible((prev) => [
          ...prev,
          {
            kind: "status" as const,
            text: item.text.replace(/\{@?MC\}/g, MC_NAME),
          },
        ]);
      }
    }

    const segment = convertBlockToSegment(block);

    const engine = createEngine({
      config: gameConfig,
      onEvent: (event: EngineEvent) => {
        if (cancelled) return;

        switch (event.type) {
          case "typing_start":
            if (event.character !== "MC") {
              setTypingCharacter(event.character);
            }
            break;

          case "typing_end":
            setTypingCharacter(null);
            break;

          case "message_shown": {
            const isMC = event.message.character === "MC";
            const isDev = event.message.character === "dev";
            setVisible((prev) => [
              ...prev,
              {
                kind: "message" as const,
                character: event.message.character,
                text: event.message.text.replace(/\{@?MC\}/g, MC_NAME),
                isMC,
                isDev,
              },
            ]);
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
            onStateChange?.({
              axes: { ...engine.getState().axes },
              counters: { ...engine.getState().counters },
              flags: Array.from(engine.getState().flags),
            });
            onEngineEvent?.(`${event.axis} → ${event.value}`);
            break;

          case "counter_changed":
            onStateChange?.({
              axes: { ...engine.getState().axes },
              counters: { ...engine.getState().counters },
              flags: Array.from(engine.getState().flags),
            });
            onEngineEvent?.(`${event.counterId} → ${event.value}`);
            break;

          case "flag_set":
            onStateChange?.({
              axes: { ...engine.getState().axes },
              counters: { ...engine.getState().counters },
              flags: Array.from(engine.getState().flags),
            });
            onEngineEvent?.(`flag: ${event.flag}`);
            break;

          case "segment_complete":
            onEngineEvent?.(`segment complete: ${event.segmentId}`);
            break;
        }
      },
    });

    onEngineReady?.({ getCounterStart: engine.getCounterStart });

    engineRef.current = engine;

    // Override chooseOption to capture the resolve
    const originalChoose = engine.chooseOption.bind(engine);

    engine.loadSegment(segment);
    engine.setPace(1.0);

    // Emit initial state
    onStateChange?.({
      axes: { ...engine.getState().axes },
      counters: { ...engine.getState().counters },
      flags: Array.from(engine.getState().flags),
    });

    // Wrap play to intercept choice_required
    const runEngine = async () => {
      // We need to intercept the choice promise.
      // The engine's play() calls waitingForChoice internally,
      // but we need the UI to call engine.chooseOption().
      // This already works because:
      // 1. Engine emits choice_required
      // 2. onEvent sets up onChoiceAvailable
      // 3. User picks -> chosenText updates
      // 4. Our useEffect calls engine.chooseOption(index)
      // 5. Engine resumes
      await engine.play();
    };

    runEngine();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => groupItems(visible), [visible]);

  return (
    <div className="flex-1 overflow-y-auto flex flex-col-reverse p-4">
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
                    const isLast = mi === group.messages.length - 1;
                    return (
                      <ChatBubble
                        key={msg.index}
                        character={group.character}
                        text={msg.text}
                        isMC={false}
                        showName={mi === 0}
                        showAvatar={isLast && !continuesWithTyping}
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
