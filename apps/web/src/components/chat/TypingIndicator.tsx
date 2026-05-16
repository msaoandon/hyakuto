import { Avatar } from "./Avatar";

type TypingIndicatorProps = {
  character: string;
  showAvatar?: boolean;
};

export function TypingIndicator({ character, showAvatar = true }: TypingIndicatorProps) {
  return (
    <div className="flex gap-2 items-end">
      <div className="w-8 shrink-0">
        <Avatar name={character} />
      </div>
      <div>
        {showAvatar && <span className="text-xs text-papaya-whip/60 ml-1">{character}</span>}
        <div className="rounded-2xl rounded-bl-sm bg-air-force-blue/10 text-air-force-blue px-4 py-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-air-force-blue/40 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-air-force-blue/40 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-air-force-blue/40 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
