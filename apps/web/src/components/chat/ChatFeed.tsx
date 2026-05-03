"use client";

import { ChatBubble } from "./ChatBubble";

const MOCK_MESSAGES = [
  { id: "1", character: "Tatsumi", text: "okay who else couldn't sleep last night", isMC: false },
  { id: "2", character: "Tatsumi", text: "bold of you to assume I sleep", isMC: false },
  { id: "3", character: "Tatsumi", text: "The wind was unusual last night.", isMC: false },
  { id: "4", character: "MC", text: "wait you guys felt that too?", isMC: true },
  {
    id: "5",
    character: "Ren",
    text: "I was on shift. But yes — the air changed around 3am.",
    isMC: false,
  },
  {
    id: "6",
    character: "Kou",
    text: "oh so we're all just casually admitting we were awake at 3am",
    isMC: false,
  },
  {
    id: "7",
    character: "Kou",
    text: "The space between stories is always thinnest before dawn 🕯️",
    isMC: false,
  },
];

export function ChatFeed() {
  return (
    <div className="flex-1 flex flex-col justify-end overflow-y-auto">
      <div className="flex flex-col gap-3 p-4">
        {MOCK_MESSAGES.map((msg, i) => {
          const prev = MOCK_MESSAGES[i - 1];
          const next = MOCK_MESSAGES[i + 1];
          const isFirst = !prev || prev.character !== msg.character;
          const isLast = !next || next.character !== msg.character;

          return (
            <div key={msg.id} className={isFirst && i > 0 ? 'mt-3' : ''}>
              <ChatBubble
                character={msg.character}
                text={msg.text}
                isMC={msg.isMC}
                showName={isFirst}
                showAvatar={isLast}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
