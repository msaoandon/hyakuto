import { memo } from "react";
import { Avatar } from "./Avatar";
import { MaskedDecor } from "./MaskedDecor";
import { Decor } from "./Decor";
import { getCharacterDesign } from "@hyakuto/game";
import { formatText } from "./formatText";

type ChatBubbleProps = {
  character: string;
  text: string;
  isMC?: boolean;
  isDev?: boolean;
  showName?: boolean;
  showAvatar?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  contentType?: "message" | "sticker" | "image";
  file?: string;
  onImageTap?: (file: string) => void;
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
  contentType,
  file,
  onImageTap,
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
            boxShadow: design.shadow,
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
        : "rounded-r-2xl rounded-l-lg";

  let topDecorPosition = "top-[-15px] right-[-30px]";
  let topDecorSize = "w-[100px] h-[40px]";

  return (
    <div className="flex gap-4 items-end">
      <div className="w-10 shrink-0 mb-2">{showAvatar && <Avatar name={character} />}</div>
      <div className="max-w-[75%]">
        {showName && (
          <span className="text-sm font-bold text-silver ml-1">{design.displayName}</span>
        )}
        <div className="relative">
          {isFirst && (
            <div className={`absolute ${topDecorPosition} ${topDecorSize} z-20`}>
            </div>
          )}
          <div
            className={`relative z-10 ${roundedClass} text-ink-black px-4 py-4 mb-2`}
            style={{
              backgroundColor: design.bgColor,
              color: design.textColor,
              border: `1px solid ${design.borderColor}`,
              boxShadow: design.shadow,
            }}
          >
            {/* <MaskedDecor character={character} /> */}
            {isLast && (
              <div className="absolute bottom-[-10px] left-[-15px] w-[40px] h-[20px]">
                <MaskedDecor
                  character={character}
                  image={design.tailUrl}
                  className="w-[40px] h-[20px]"
                />
              </div>
            )}
            {contentType === "sticker" ? (
              <img src={`/stickers/${file}`} alt="sticker" className="w-24 h-24 object-contain" />
            ) : contentType === "image" ? (
              <button onClick={() => onImageTap?.(file!)}>
                <img
                  src={`/images/${file}`}
                  alt="shared image"
                  className="max-w-[200px] rounded-lg"
                />
              </button>
            ) : (
              <p className="text-lg whitespace-pre-line">{formatText(text)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const ChatBubble = memo(ChatBubbleInner);
