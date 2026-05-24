import { memo } from "react";
import { Avatar } from "./Avatar";
import { MaskedDecor } from "./MaskedDecor";
import { getCharacterDesign } from "@hyakuto/game";

type ChatBubbleProps = {
  character: string;
  text: string;
  isMC?: boolean;
  isDev?: boolean;
  showName?: boolean;
  showAvatar?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
};

function ChatBubbleInner({
  character,
  text,
  isMC = false,
  isDev = false,
  showName = true,
  showAvatar = true,
  isFirst,
  isLast,
}: ChatBubbleProps) {
  const design = getCharacterDesign(isMC || isDev ? "mc" : character);

  if (isMC || isDev) {
    return (
      <div className="flex flex-col items-end">
        {isDev && showName && <span className="text-sm text-silver/60 mr-1 mb-0.5">dev</span>}
        <div
          className={`max-w-[75%] rounded-xl rounded-br-sm px-3 py-2`}
          style={{
            backgroundColor: design.bgColor,
            color: design.textColor,
            border: `1px solid ${design.borderColor}`,
            boxShadow: design.shadow
          }}
        >
          <p className="text-lg whitespace-pre-line">{text}</p>
        </div>
      </div>
    );
  }

  const isSingle = isFirst && isLast;
  const roundedClass = isSingle
    ? "rounded-2xl rounded-bl-sm"
    : isFirst
      ? "rounded-t-2xl rounded-bl-lg rounded-br-2xl"
      : isLast
        ? "rounded-br-2xl rounded-tr-2xl rounded-tl-lg"
        : "rounded-r-2xl";

  return (
    <div className="flex gap-2 items-end">
      <div className="w-10 shrink-0 mb-2">{showAvatar && <Avatar name={character} />}</div>
      <div className="max-w-[75%]">
        {showName && (
          <span className="text-sm font-bold text-silver ml-1">{design.displayName}</span>
        )}
        <div
          className={`relative ${roundedClass} text-ink-black px-4 py-4 mb-2`}
          style={{
            backgroundColor: design.bgColor,
            color: design.textColor,
            border: `1px solid ${design.borderColor}`,
            boxShadow: design.shadow
          }}
        >
          {/* <MaskedDecor character={character} /> */}
          <p className="text-lg whitespace-pre-line">{text}</p>
        </div>
      </div>
    </div>
  );
}

export const ChatBubble = memo(ChatBubbleInner);
