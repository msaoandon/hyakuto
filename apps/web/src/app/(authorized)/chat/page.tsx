'use client';

import { useState } from 'react';
import { ChatFeed } from '@/components/chat/ChatFeed';
import { ChoiceModal } from '@/components/chat/ChoiceModal';

type PendingChoice = {
  options: { text: string }[];
};

export default function ChatPage() {
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [chosenText, setChosenText] = useState<string | null>(null);

  const handleChoiceAvailable = (choice: PendingChoice) => {
    setPendingChoice(choice);
  };

  const handleReplyTap = () => {
    if (pendingChoice) {
      setModalOpen(true);
    }
  };

  const handleChoose = (index: number) => {
    if (!pendingChoice) return;
    setChosenText(pendingChoice.options[index].text);
    setModalOpen(false);
  };

  const handleChoiceConsumed = () => {
    setPendingChoice(null);
  };

  const handleChosenRendered = () => {
    setChosenText(null);
  };

  const replyEnabled = pendingChoice !== null && chosenText === null;

  return (
    <>
      <ChatFeed
        onChoiceAvailable={handleChoiceAvailable}
        onChoiceConsumed={handleChoiceConsumed}
        chosenText={chosenText}
        onChosenRendered={handleChosenRendered}
      />
      <footer className="shrink-0 px-4 py-3 pb-[env(safe-area-inset-bottom)] border-t border-beige/10">
        <button
          onClick={handleReplyTap}
          disabled={!replyEnabled}
          className={`w-full py-2 rounded-lg font-medium transition-colors
            ${replyEnabled
              ? 'bg-papaya-whip text-ink-black'
              : 'bg-papaya-whip/10 text-silver/30 cursor-not-allowed'
            }`}
        >
          Reply
        </button>
      </footer>
      {modalOpen && pendingChoice && (
        <ChoiceModal
          options={pendingChoice.options}
          onChoose={handleChoose}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}