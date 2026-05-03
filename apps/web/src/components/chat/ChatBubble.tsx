import { Avatar } from './Avatar';

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
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-gold/90 text-dark-gray px-3 py-2">
          <p className="text-sm">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-end">
      <div className="w-8 shrink-0">
        {showAvatar && <Avatar name={character} />}
      </div>
      <div className="max-w-[75%]">
        {showName && <span className="text-xs text-beige/60 ml-1">{character}</span>}
        <div className="rounded-2xl rounded-bl-sm bg-beige/10 text-beige px-3 py-2">
          <p className="text-sm">{text}</p>
        </div>
      </div>
    </div>
  );
}
