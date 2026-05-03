import { Avatar } from './Avatar';
import { CHARACTER_COLORS, DEFAULT_BUBBLE_COLOR } from './colors';

type ChatBubbleProps = {
  character: string;
  text: string;
  isMC?: boolean;
  showName?: boolean;
  showAvatar?: boolean;
};

export function ChatBubble({ character, text, isMC = false, showName = true, showAvatar = true }: ChatBubbleProps) {
  if (isMC) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-lavelnder-veil text-ink-black rounded-xl rounded-br-sm bg-gold/90 text-dark-gray px-3 py-2">
          <p className="text-sm whitespace-pre-line">{text}</p>
        </div>
      </div>
    );
  }

  const bubbleColor = CHARACTER_COLORS[character] ?? DEFAULT_BUBBLE_COLOR;

  return (
    <div className="flex gap-2 items-end">
      <div className="w-8 shrink-0">
        {showAvatar && <Avatar name={character} />}
      </div>
      <div className="max-w-[75%]">
        {showName && <span className="text-xs font-bold text-silver ml-1">{character}</span>}
        <div className="bg-beige/10 rounded-xl rounded-bl-sm text-ink-black px-3 py-2" style={{ backgroundColor: bubbleColor }}>
          <p className="text-sm whitespace-pre-line">{text}</p>
        </div> 
      </div>
    </div>
  );
}
