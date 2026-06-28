"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SegmentInput } from "@hyakuto/engine";
import { gameConfig } from "@hyakuto/game";
import { ChatFeed } from "./ChatFeed";
import { ChoiceModal } from "./ChoiceModal";
import { ImageModal } from "./ImageModal";
import { DevConsole } from "@/components/debug/DevConsole";
import { StoryHeader } from "@/components/layout/StoryHeader";
import { useT } from "@/i18n";
import type { PendingChoice } from "./types";

/**
 * Plays one assembled, chat-style segment: streaming feed, typing, choices,
 * images, candle progress, and the Reply/Exit footer. Used by both day chats
 * (ChatView) and DMs (DmView) — they differ only in how the segment is
 * assembled and where Exit/back go.
 */
export function ThreadPlayer({
  segment,
  title,
  back,
}: {
  segment: SegmentInput;
  title: string;
  back: string;
}) {
  const router = useRouter();
  const t = useT();

  const [openImage, setOpenImage] = useState<string | null>(null);
  const [candleProgress, setCandleProgress] = useState(1);
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [chosenText, setChosenText] = useState<string | null>(null);
  const [devState, setDevState] = useState({
    axes: {} as Record<string, number>,
    counters: {} as Record<string, number>,
    flags: [] as string[],
  });
  const [lastEvent, setLastEvent] = useState<string>();
  const [threadEnded, setThreadEnded] = useState(false);

  useEffect(() => {
    document.body.style.setProperty("--candle-progress", String(candleProgress));
  }, [candleProgress]);

  const handleChoiceAvailable = useCallback((choice: PendingChoice) => {
    setPendingChoice(choice);
  }, []);
  const handleChoiceConsumed = useCallback(() => setPendingChoice(null), []);
  const handleChosenRendered = useCallback(() => setChosenText(null), []);

  const candleStart = gameConfig.counters.find((c) => c.id === "candles")?.start ?? 100;
  const showExit = threadEnded && !pendingChoice;
  const replyEnabled = pendingChoice !== null && chosenText === null;

  const handleExit = () => router.push(back);

  const handleStateChange = (state: {
    axes: Record<string, number>;
    counters: Record<string, number>;
    flags: string[];
  }) => {
    setDevState(state);
    if ("candles" in state.counters) setCandleProgress(state.counters.candles / candleStart);
  };

  const handleReplyTap = () => {
    if (pendingChoice) setModalOpen(true);
  };
  const handleChoose = (index: number) => {
    if (!pendingChoice) return;
    setChosenText(pendingChoice.options[index]!.text);
    setModalOpen(false);
  };

  return (
    <>
      <div className="fixed inset-0 -z-10 chat-bg" aria-hidden="true" />
      <StoryHeader back={back} title={title} />
      <ChatFeed
        segment={segment}
        onStateChange={handleStateChange}
        onChoiceAvailable={handleChoiceAvailable}
        onChoiceConsumed={handleChoiceConsumed}
        chosenText={chosenText}
        onChosenRendered={handleChosenRendered}
        onEngineEvent={setLastEvent}
        onImageTap={setOpenImage}
        onThreadEnded={() => setThreadEnded(true)}
      />
      <footer className="shrink-0 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-black/10">
        {showExit ? (
          <button
            onClick={handleExit}
            className="w-full py-2 rounded-xl font-medium border-2 border-solid border-[#2f406d] bg-gradient-to-t from-[#162347] to-[#2f406d] text-[#daccd0]"
            style={{ textShadow: "0 0 4px rgba(255,242,226,0.6), 0 0 12px rgba(255,242,226,0.4)" }}
          >
            {t("play.exit")}
          </button>
        ) : (
          <button
            onClick={handleReplyTap}
            disabled={!replyEnabled}
            className={`w-full py-2 rounded-xl font-medium transition-colors border-2 border-solid border-[#2f406d]
            ${
              replyEnabled
                ? "bg-gradient-to-t from-[#162347] to-[#2f406d] text-[#daccd0]"
                : "bg-gradient-to-t from-[#162347]/50 to-[#2f406d]/50 text-[#daccd0]/30 cursor-not-allowed"
            }
          `}
            style={
              replyEnabled
                ? { textShadow: "0 0 4px rgba(255,242,226,0.6), 0 0 12px rgba(255,242,226,0.4)" }
                : {}
            }
          >
            {t("play.reply")}
          </button>
        )}
      </footer>
      {openImage && <ImageModal file={openImage} onClose={() => setOpenImage(null)} />}
      {modalOpen && pendingChoice && (
        <ChoiceModal
          options={pendingChoice.options}
          onChoose={handleChoose}
          onClose={() => setModalOpen(false)}
        />
      )}
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
