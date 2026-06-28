"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

export function VnView({ day, id }: { day: string; id: string }) {
  const router = useRouter();
  const t = useT();
  const dayNum = Number(day);

  const [candleProgress, setCandleProgress] = useState(1);
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(null);
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

  // Next: snap a still-revealing line to full, otherwise step forward.
  const handleNext = () => {
    if (current && !done) finish();
    else advance();
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
        {threadEnded && !pendingChoice ? (
          <button
            onClick={handleExit}
            className={`w-full py-2 bg-gradient-to-t from-[#162347] to-[#2f406d] ${controlBtn}`}
          >
            {t("play.exit")}
          </button>
        ) : pendingChoice ? (
          <VnChoices options={pendingChoice.options} onChoose={choose} />
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={finish} className={`flex-1 bg-[#162347]/60 ${controlBtn}`}>
              {t("play.skip")}
            </button>
            <button
              onClick={() => setAuto((a) => !a)}
              aria-pressed={auto}
              className={`flex-1 ${controlBtn} ${auto ? "bg-[#2f406d]" : "bg-[#162347]/60"}`}
            >
              {t("play.auto")}
            </button>
            <button
              onClick={handleNext}
              className={`flex-1 bg-gradient-to-t from-[#162347] to-[#2f406d] ${controlBtn}`}
            >
              {t("play.next")}
            </button>
          </div>
        )}
      </footer>

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
