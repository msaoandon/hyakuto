import { Avatar } from "./Avatar";
import { CHARACTER_COLORS, DEFAULT_BUBBLE_COLOR } from "./colors";

type ChatBubbleProps = {
  character: string;
  text: string;
  isMC?: boolean;
  isDev?: boolean;
  showName?: boolean;
  showAvatar?: boolean;
};

export function ChatBubble({
  character,
  text,
  isMC = false,
  isDev = false,
  showName = true,
  showAvatar = true,
}: ChatBubbleProps) {
  if (isMC || isDev) {
    const bubbleStyle = isMC ? "bg-lavelnder-veil text-ink-black " : "bg-silver text-ink-black";
    return (
      <div className="flex flex-col items-end">
        {isDev && showName && <span className="text-xs text-silver/60 mr-1 mb-0.5">dev</span>}
        <div className={`max-w-[75%] rounded-xl rounded-br-sm px-3 py-2 ${bubbleStyle}`}>
          <p className="text-base whitespace-pre-line">{text}</p>
        </div>
      </div>
    );
  }

  const bubbleColor = CHARACTER_COLORS[character] ?? DEFAULT_BUBBLE_COLOR;

  return (
    <div className="flex gap-2 items-end">
      <div className="w-8 shrink-0">{showAvatar && <Avatar name={character} />}</div>
      <div className="max-w-[75%]">
        {showName && <span className="text-xs font-bold text-silver ml-1">{character}</span>}
        <div
          className="bg-beige/10 rounded-xl rounded-bl-sm text-ink-black px-3 py-2"
          style={{ backgroundColor: bubbleColor }}
        >
          <p className="text-base whitespace-pre-line">{text}</p>
        </div>
      </div>
    </div>
  );
}
