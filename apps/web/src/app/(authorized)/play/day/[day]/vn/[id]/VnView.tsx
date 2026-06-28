"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { gameConfig } from "@hyakuto/game";
import { assembleThread, stripEffects } from "@/data/loadDay";
import { useGameStore, saveToState } from "@/store/gameStore";
import { useT } from "@/i18n";
import { VnStage } from "@/components/vn/VnStage";
import { VnNarration } from "@/components/vn/VnNarration";
import { VnSpeech } from "@/components/vn/VnSpeech";
import { VnChoices } from "@/components/vn/VnChoices";
import { useVnEngine } from "@/components/vn/useVnEngine";
import { useTypewriter } from "@/components/vn/useTypewriter";
import { DevConsole } from "@/components/debug/DevConsole";
import type { PendingChoice } from "@/components/chat/types";

const AUTO_DELAY_MS = 800;
// The MC chooser appears after the prompting line finishes. On a natural finish
// we hold a beat so it doesn't snatch control away; on a manual Skip the player
// asked to move on, so show it almost immediately.
const CHOOSER_DELAY_MS = 1500;
const CHOOSER_SKIP_DELAY_MS = 150;

export function VnView({ day, id }: { day: string; id: string }) {
  const router = useRouter();
  const t = useT();
  const dayNum = Number(day);

  const [candleProgress, setCandleProgress] = useState(1);
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(null);
  const [chooserVisible, setChooserVisible] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [auto, setAuto] = useState(false);
  const [threadEnded, setThreadEnded] = useState(false);
  const [lastEvent, setLastEvent] = useState<string>();
  const [devState, setDevState] = useState({
    axes: {} as Record<string, number>,
    counters: {} as Record<string, number>,
    flags: [] as string[],
  });

  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);

  const segment = useMemo(() => {
    const seg = assembleThread(dayNum, id, saveToState(save, completed));
    const isReplay = `${dayNum}:${id}` in completed;
    return isReplay ? stripEffects(seg) : seg;
  }, [dayNum, id, save, completed]);

  const candleStart = gameConfig.counters.find((c) => c.id === "candles")?.start ?? 100;

  const handleStateChange = useCallback(
    (state: { axes: Record<string, number>; counters: Record<string, number>; flags: string[] }) => {
      setDevState(state);
      if ("candles" in state.counters) setCandleProgress(state.counters.candles / candleStart);
    },
    [candleStart],
  );

  const { current, scene, advance, choose } = useVnEngine(segment, {
    onChoiceAvailable: setPendingChoice,
    onChoiceConsumed: () => setPendingChoice(null),
    onStateChange: handleStateChange,
    onEngineEvent: setLastEvent,
    onThreadEnded: () => setThreadEnded(true),
  });

  const { shown, done, finish } = useTypewriter(current?.id ?? "", current?.text ?? "");

  useEffect(() => {
    document.body.style.setProperty("--candle-progress", String(candleProgress));
  }, [candleProgress]);

  // Auto mode: once the current line is fully revealed, advance after a beat.
  // Pauses while a chooser is open or the thread has ended.
  useEffect(() => {
    if (!auto || !current || !done || pendingChoice || threadEnded) return;
    const timer = setTimeout(() => advance(), AUTO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [auto, current, done, pendingChoice, threadEnded, advance]);

  // A fresh message clears the "skipped" intent (it's per-line).
  useEffect(() => setSkipped(false), [current?.id]);

  // Reveal the chooser once the prompting line has finished typing. Hold a beat
  // on a natural finish; show it right away if the player skipped to it. Reset
  // whenever the choice clears (after the player picks).
  useEffect(() => {
    if (!pendingChoice) {
      setChooserVisible(false);
      return;
    }
    if (!current || !done) return;
    const timer = setTimeout(
      () => setChooserVisible(true),
      skipped ? CHOOSER_SKIP_DELAY_MS : CHOOSER_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [pendingChoice, current, done, skipped]);

  // Next: snap a still-revealing line to full (recording the skip intent so the
  // chooser, if any, shows promptly), otherwise step forward.
  const handleNext = () => {
    if (current && !done) {
      setSkipped(true);
      finish();
    } else {
      advance();
    }
  };

  const handleExit = () => router.push(`/play/day/${dayNum}`);

  const controlBtn =
    "px-4 py-2 rounded-xl font-medium border-2 border-solid border-[#2f406d] text-[#daccd0]";

  return (
    <>
      <VnStage scene={scene} />

      {/* Dialogue area — tapping it also advances (classic VN). */}
      <div className="flex-1 flex flex-col justify-end p-4" onClick={handleNext}>
        <div className="rounded-2xl bg-black/55 backdrop-blur-sm border border-[#2f406d]/60 p-5 min-h-[8rem]">
          {current &&
            (current.isNarration ? (
              <VnNarration text={shown} />
            ) : (
              <VnSpeech character={current.character} text={shown} isMC={current.isMC} />
            ))}
        </div>
      </div>

      <footer className="shrink-0 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-black/10">
        {threadEnded && done ? (
          <button
            onClick={handleExit}
            className={`w-full py-2 bg-gradient-to-t from-[#162347] to-[#2f406d] ${controlBtn}`}
          >
            {t("play.exit")}
          </button>
        ) : pendingChoice && done ? (
          // The prompting line is typed; the chooser overlay is taking over.
          // Hide the step controls so the player only sees the choice.
          <div className="h-[2.75rem]" />
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAuto((a) => !a)}
              aria-pressed={auto}
              className={`${controlBtn} ${auto ? "bg-[#2f406d]" : "bg-[#162347]/60"}`}
            >
              {t("play.auto")}
            </button>
            {/* One button: "Skip" while a line is still typing (snaps it to full),
                "Next" once it's done (advances to the next message). */}
            <button
              onClick={handleNext}
              className={`flex-1 bg-gradient-to-t from-[#162347] to-[#2f406d] ${controlBtn}`}
            >
              {current && !done ? t("play.skip") : t("play.next")}
            </button>
          </div>
        )}
      </footer>

      <AnimatePresence>
        {chooserVisible && pendingChoice && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="w-full max-w-lg p-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
              <VnChoices options={pendingChoice.options} onChoose={choose} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {process.env.NODE_ENV === "development" && (
        <DevConsole
          axes={devState.axes}
          counters={devState.counters}
          flags={devState.flags}
          lastEvent={lastEvent}
        />
      )}
    </>
  );
}
