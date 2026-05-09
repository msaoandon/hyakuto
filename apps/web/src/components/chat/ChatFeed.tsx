// components/chat/ChatFeed.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatBubble } from "./ChatBubble";
import { StatusMessage } from "./StatusMessage";
import { TypingIndicator } from "./TypingIndicator";
import { createEngine, type EngineEvent, type SegmentInput, type StoryFile } from "@hyakuto/engine";
import type { Block, GameConfig } from "@hyakuto/engine";
import demoData from "@/data/demo.json";

const MC_NAME = "You";

// ─── GAME CONFIG ─────────────────────────────────────────
// This moves to @hyakuto/game later. Hardcoded here for Phase 1.
const gameConfig: GameConfig = {
  axes: ["story", "kou", "tatsumi"],
  characters: [
    { id: "Ao", typing_rate: 1.0 },
    { id: "Kou", typing_rate: 0.6 },
    { id: "Haruki", typing_rate: 0.8 },
    { id: "Tatsumi", typing_rate: 1.4 },
    { id: "Ren", typing_rate: 1.2 },
    { id: "Mio", typing_rate: 1.0 },
    { id: "Kaname", typing_rate: 1.0 },
  ],
  counters: [{ id: "candles", start: 100, end: 0, direction: "down" as const }],
};

// ─── CONVERT DEMO JSON TO SEGMENT INPUT ──────────────────
// Bridge between your current JSON format and the engine's SegmentInput.
// This adapter disappears when the Apps Script exporter outputs the engine format directly.

function convertBlockToSegment(block: Block): SegmentInput {
  const messages: SegmentInput["messages"] = [];
  const choices: Record<string, { text: string; effects?: { axis: string; delta: number }[] }[]> =
    {};

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
          choices[lastMsgId] = item.options.map((opt) => ({
            text: opt.text,
            effects: opt.effects,
          }));
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
  onStateChange?: (state: {
    axes: Record<string, number>;
    counters: Record<string, number>;
    flags: string[];
  }) => void;
  onEngineEvent?: (event: string) => void;
};

// ─── COMPONENT ───────────────────────────────────────────

export function ChatFeed({
  onChoiceAvailable,
  onChoiceConsumed,
  chosenText,
  onChosenRendered,
  onStateChange,
  onEngineEvent,
}: ChatFeedProps) {
  const [visible, setVisible] = useState<VisibleItem[]>([]);
  const [typingCharacter, setTypingCharacter] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
  const choiceResolveRef = useRef<((index: number) => void) | null>(null);
  const pendingOptionsRef = useRef<{ text: string }[]>([]);
  const blocks = demoData as StoryFile;
  const block = blocks[0]!;

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [visible, typingCharacter, scrollToBottom]);

  // Handle choice selection
  useEffect(() => {
    if (chosenText && pendingOptionsRef.current.length > 0) {
      const index = pendingOptionsRef.current.findIndex((o) => o.text === chosenText);
      if (index >= 0) {
        // Add MC reply bubble
        setVisible((prev) => [...prev, { kind: "mc-reply", text: chosenText }]);

        // Tell the engine
        try {
          engineRef.current?.chooseOption(index);
        } catch {
          // No pending choice
        }

        pendingOptionsRef.current = [];
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
            setTypingCharacter(event.character);
            break;

          case "typing_end":
            setTypingCharacter(null);
            break;

          case "message_shown": {
            const isMC = event.message.character === "MC";
            setVisible((prev) => [
              ...prev,
              {
                kind: "message" as const,
                character: event.message.character,
                text: event.message.text.replace(/\{@?MC\}/g, MC_NAME),
                isMC,
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
            onChoiceAvailable({ options: substituted });
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

          case "flag_set":
            onStateChange?.({
              axes: { ...engine.getState().axes },
              counters: { ...engine.getState().counters },
              flags: Array.from(engine.getState().flags),
            });
            onEngineEvent?.(`flag: ${event.flag}`);
            break;

          case "message_shown":
            onEngineEvent?.(`${event.message.character}: ${event.message.text.slice(0, 30)}...`);
            // ...existing message_shown handling
            break;

          case "segment_complete":
            onEngineEvent?.(`segment complete: ${event.segmentId}`);
            break;
        }
      },
    });

    engineRef.current = engine;

    // Override chooseOption to capture the resolve
    const originalChoose = engine.chooseOption.bind(engine);

    engine.loadSegment(segment);
    engine.setPace(1.0);

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

  // Bridge: when choice is made, tell the engine
  useEffect(() => {
    if (chosenText && engineRef.current) {
      const index = pendingOptionsRef.current.findIndex((o) => o.text === chosenText);
      if (index >= 0) {
        try {
          engineRef.current.chooseOption(index);
        } catch {
          // Already handled or no pending choice
        }
      }
    }
  }, [chosenText]);

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
