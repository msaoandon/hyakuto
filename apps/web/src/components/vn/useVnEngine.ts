"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createEngine, NARRATOR, type EngineEvent, type SegmentInput } from "@hyakuto/engine";
import { gameConfig } from "@hyakuto/game";
import { useGameStore } from "@/store/gameStore";
import { substituteMC } from "../chat/helpers/mc";
import type { PendingChoice, EngineSnapshot } from "../chat/types";

type Engine = ReturnType<typeof createEngine>;

/** The single message the VN reader shows at a time (replaces the previous). */
export type VnItem = {
  id: string;
  character: string;
  text: string;
  isNarration: boolean;
  isMC: boolean;
};

function snapshot(engine: Engine): EngineSnapshot {
  const s = engine.getState();
  return { axes: { ...s.axes }, counters: { ...s.counters }, flags: Array.from(s.flags) };
}

export type VnEngineHandlers = {
  onChoiceAvailable: (choice: PendingChoice) => void;
  onChoiceConsumed: () => void;
  onStateChange?: (state: EngineSnapshot) => void;
  onEngineEvent?: (event: string) => void;
  onThreadEnded?: () => void;
};

/**
 * Drives a VN thread as a step-through reader: the engine plays in `stepped`
 * mode (one message, then it parks on a gate). The hook owns the engine and
 * exposes the current message, the active scene, and the advance/choose actions.
 */
export function useVnEngine(segment: SegmentInput, handlers: VnEngineHandlers) {
  const { onChoiceAvailable, onChoiceConsumed, onStateChange, onEngineEvent, onThreadEnded } =
    handlers;

  const [current, setCurrent] = useState<VnItem | null>(null);
  const [scene, setScene] = useState<string | undefined>(undefined);
  const engineRef = useRef<Engine | null>(null);
  const pendingOptionsRef = useRef<{ text: string }[]>([]);
  const pendingChoiceIndexRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    useGameStore.getState().clearCues(); // fresh thread → no stale cues

    const engine = createEngine({
      config: gameConfig,
      savedState: useGameStore.getState().save,
      onEvent: (event: EngineEvent) => {
        if (cancelled) return;
        switch (event.type) {
          case "cue":
            if (event.channel === "scene") {
              setScene(event.value); // render-local, not persisted to the save
            } else {
              useGameStore.getState().setCue(event.channel, event.value);
            }
            onEngineEvent?.(`cue: ${event.channel} = ${event.value}`);
            break;
          case "message_shown": {
            const m = event.message;
            setCurrent({
              id: m.id,
              character: m.character,
              text: substituteMC(m.text),
              isNarration: m.character === NARRATOR,
              isMC: m.character === "MC",
            });
            break;
          }
          case "choice_required": {
            const options = event.options.map((o) => ({ ...o, text: substituteMC(o.text) }));
            pendingOptionsRef.current = options;
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
    engine.loadSegment(segment);
    onStateChange?.(snapshot(engine));
    engine.play({ stepped: true });

    return () => {
      cancelled = true;
    };
  }, [segment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Player picks an option: show their line as MC speech first; resuming the
  // engine (chooseOption) is deferred to the next advance so the line is read.
  const choose = useCallback(
    (index: number) => {
      const opt = pendingOptionsRef.current[index];
      if (!opt) return;
      pendingChoiceIndexRef.current = index;
      setCurrent({
        id: `mc_choice_${index}_${Date.now()}`,
        character: "MC",
        text: opt.text,
        isNarration: false,
        isMC: true,
      });
      onChoiceConsumed();
    },
    [onChoiceConsumed],
  );

  // Next: resume past a just-chosen MC line via chooseOption, else step the reader.
  const advance = useCallback(() => {
    const i = pendingChoiceIndexRef.current;
    if (i !== null) {
      pendingChoiceIndexRef.current = null;
      pendingOptionsRef.current = [];
      try {
        engineRef.current?.chooseOption(i);
      } catch {}
      return;
    }
    engineRef.current?.advance();
  }, []);

  return { current, scene, advance, choose };
}
