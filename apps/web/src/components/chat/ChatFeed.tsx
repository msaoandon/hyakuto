// components/chat/ChatFeed.tsx
"use client";

import { useMemo } from "react";
import { ChatBubble } from "./ChatBubble";
import { StatusMessage } from "./StatusMessage";
import { TypingIndicator } from "./TypingIndicator";
import type { SegmentInput } from "@hyakuto/engine";
import { groupItems } from "./helpers/groupMessages";
import { useChatEngine, type ChatEngineHandlers } from "./hooks/useChatEngine";
import { MC_NAME } from "./helpers/mc";

type ChatFeedProps = ChatEngineHandlers & {
  segment: SegmentInput;
  chosenText: string | null;
  onImageTap?: (file: string) => void;
};

export function ChatFeed({ segment, chosenText, onImageTap, ...handlers }: ChatFeedProps) {
  const { visible, typingCharacter } = useChatEngine(segment, chosenText, handlers);
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
                    const isFirst = mi === 0;
                    const isLast = mi === group.messages.length - 1;
                    return (
                      <ChatBubble
                        key={msg.index}
                        character={group.character}
                        text={msg.text}
                        isMC={false}
                        showName={mi === 0}
                        showAvatar={isLast && !continuesWithTyping}
                        isFirst={isFirst}
                        isLast={isLast}
                        contentType={msg.kind as "message" | "sticker" | "image" | undefined}
                        file={msg.file!}
                        onImageTap={onImageTap}
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
