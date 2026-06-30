"use client";

import { useState, useEffect, useRef } from "react";
import { createEngine, type EngineEvent, type SegmentInput } from "@hyakuto/engine";
import { gameConfig } from "@hyakuto/game";
import { useGameStore, paceMultiplier } from "@/store/gameStore";
import { messageToItem } from "../helpers/eventToItem";
import { substituteMC } from "../helpers/mc";
import type { VisibleItem, PendingChoice, EngineSnapshot } from "../types";

type Engine = ReturnType<typeof createEngine>;

function snapshot(engine: Engine): EngineSnapshot {
  const s = engine.getState();
  return { axes: { ...s.axes }, counters: { ...s.counters }, flags: Array.from(s.flags) };
}

export type ChatEngineHandlers = {
  onChoiceAvailable: (choice: PendingChoice) => void;
  onChoiceConsumed: () => void;
  onChosenRendered: () => void;
  onStateChange?: (state: EngineSnapshot) => void;
  onEngineEvent?: (event: string) => void;
  onThreadEnded?: () => void;
};

/**
 * Drives a per-thread engine playthrough and exposes the view state the feed
 * renders. Owns the engine lifecycle so the component stays presentational.
 */
export function useChatEngine(
  segment: SegmentInput,
  chosenText: string | null,
  handlers: ChatEngineHandlers,
) {
  const {
    onChoiceAvailable,
    onChoiceConsumed,
    onChosenRendered,
    onStateChange,
    onEngineEvent,
    onThreadEnded,
  } = handlers;

  const [visible, setVisible] = useState<VisibleItem[]>([]);
  const [typingCharacter, setTypingCharacter] = useState<string | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const pendingOptionsRef = useRef<{ text: string }[]>([]);
  const pendingCharacterRef = useRef<string | undefined>(undefined);

  // Live chat-speed preference — applied immediately so a mid-chat change speeds
  // up / slows down the remaining drip (the engine reads pace at playback time).
  const chatPaceLevel = useGameStore((s) => s.chatPaceLevel);
  useEffect(() => {
    engineRef.current?.setPace(paceMultiplier(chatPaceLevel));
  }, [chatPaceLevel]);

  // Render the player's chosen reply, then advance the engine past the choice.
  useEffect(() => {
    if (!chosenText || pendingOptionsRef.current.length === 0) return;
    const index = pendingOptionsRef.current.findIndex((o) => o.text === chosenText);
    if (index < 0) return;

    const isDev = pendingCharacterRef.current === "dev";
    setVisible((prev) => [...prev, { kind: "mc-reply", text: chosenText, isDev }]);

    try {
      engineRef.current?.chooseOption(index);
    } catch {}

    pendingOptionsRef.current = [];
    pendingCharacterRef.current = undefined;
    onChoiceConsumed();
    onChosenRendered();
  }, [chosenText, onChoiceConsumed, onChosenRendered]);

  // Start playback — plays the assembled thread as one segment.
  useEffect(() => {
    let cancelled = false;
    useGameStore.getState().clearCues(); // fresh thread → no active cues on any channel

    const engine = createEngine({
      config: gameConfig,
      savedState: useGameStore.getState().save,
      onEvent: (event: EngineEvent) => {
        if (cancelled) return;
        switch (event.type) {
          case "cue":
            useGameStore.getState().setCue(event.channel, event.value);
            onEngineEvent?.(`cue: ${event.channel} = ${event.value}`);
            break;
          case "typing_start":
            if (event.character !== "MC") setTypingCharacter(event.character);
            break;
          case "typing_end":
            setTypingCharacter(null);
            break;
          case "message_shown":
            setVisible((prev) => [...prev, messageToItem(event.message)]);
            break;
          case "choice_required": {
            const options = event.options.map((o) => ({ ...o, text: substituteMC(o.text) }));
            pendingOptionsRef.current = options;
            pendingCharacterRef.current = event.character;
            onChoiceAvailable({ options, character: event.character });
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
          case "segment_complete":
            useGameStore.getState().completeThread(event.segmentId, engine.serialize());
            onEngineEvent?.(`segment complete: ${event.segmentId}`);
            onThreadEnded?.();
            break;
        }
      },
    });

    engineRef.current = engine;
    engine.setPace(paceMultiplier(useGameStore.getState().chatPaceLevel));
    engine.loadSegment(segment);
    onStateChange?.(snapshot(engine));
    engine.play();

    return () => {
      cancelled = true;
    };
  }, [segment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { visible, typingCharacter };
}
