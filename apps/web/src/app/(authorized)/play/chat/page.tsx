"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatFeed } from "@/components/chat/ChatFeed";
import { ChoiceModal } from "@/components/chat/ChoiceModal";
import { DevConsole } from "@/components/debug/DevConsole";
import { gameConfig } from "@hyakuto/game";
import { ImageModal } from "@/components/chat/ImageModal";
import { usePlay } from "../layout";

type PendingChoice = {
  options: { text: string }[];
  character?: string;
};

export default function ChatPage() {
  const router = useRouter();
  const { selectedChat } = usePlay();
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
  const [segmentEnded, setSegmentEnded] = useState(false);
  const [hasNextSegment, setHasNextSegment] = useState(false);
  const advanceRef = useRef<(() => void) | null>(null);

  const handleNext = () => {
    advanceRef.current?.();
    setSegmentEnded(false);
    setHasNextSegment(false);
  };

  const showNext = segmentEnded && hasNextSegment && !pendingChoice;

  const candleStart = gameConfig.counters.find((c) => c.id === "candles")?.start ?? 100;

  useEffect(() => {
    if (!selectedChat) router.replace("/play");
  }, [selectedChat, router]);
  if (!selectedChat) return null;

  useEffect(() => {
    document.body.style.setProperty("--candle-progress", String(candleProgress));
  }, [candleProgress]);

  const handleStateChange = (state: {
    axes: Record<string, number>;
    counters: Record<string, number>;
    flags: string[];
  }) => {
    setDevState(state);
    if ("candles" in state.counters) {
      setCandleProgress(state.counters.candles / candleStart);
    }
  };

  const handleChoiceAvailable = useCallback((choice: PendingChoice) => {
    setPendingChoice(choice);
  }, []);

  const handleReplyTap = () => {
    if (pendingChoice) {
      setModalOpen(true);
    }
  };

  const handleChoose = (index: number) => {
    if (!pendingChoice) return;
    setChosenText(pendingChoice.options[index]!.text);
    setModalOpen(false);
  };

  const handleChoiceConsumed = useCallback(() => {
    setPendingChoice(null);
  }, []);

  const handleChosenRendered = useCallback(() => {
    setChosenText(null);
  }, []);

  const replyEnabled = pendingChoice !== null && chosenText === null;

  return (
    <>
      <ChatFeed
        segmentId={selectedChat}
        onStateChange={handleStateChange}
        onChoiceAvailable={handleChoiceAvailable}
        onChoiceConsumed={handleChoiceConsumed}
        chosenText={chosenText}
        onChosenRendered={handleChosenRendered}
        onEngineEvent={setLastEvent}
        onImageTap={setOpenImage}
        onEngineReady={(api) => {
          advanceRef.current = api.advance;
        }}
        onSegmentEnded={(hasNext) => {
          setSegmentEnded(true);
          setHasNextSegment(hasNext);
        }}
      />
      <footer className="shrink-0 px-4 py-3 pb-[env(safe-area-inset-bottom)]">
        {showNext ? (
          <button
            onClick={handleNext}
            className="w-full py-2 rounded-xl font-medium border-2 border-solid border-[#2f406d] bg-gradient-to-t from-[#162347] to-[#2f406d] text-[#daccd0]"
            style={{ textShadow: "0 0 4px rgba(255,242,226,0.6), 0 0 12px rgba(255,242,226,0.4)" }}
          >
            Next
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
                ? {
                    textShadow: "0 0 4px rgba(255,242,226,0.6), 0 0 12px rgba(255,242,226,0.4)",
                  }
                : {}
            }
          >
            Reply
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
