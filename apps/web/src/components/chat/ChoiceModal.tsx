'use client';

type ChoiceModalProps = {
  options: { text: string }[];
  onChoose: (index: number) => void;
  onClose: () => void;
};

export function ChoiceModal({ options, onChoose, onClose }: ChoiceModalProps) {
  const chooseAt = (i: number) => () => onChoose(i);
  const swallowClick = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80" />
      <div
        className="relative w-full max-w-lg bg-dark-gray rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
        onClick={swallowClick}
      >
        <div className="w-10 h-1 bg-beige/20 rounded-full mx-auto mb-4" />
        <div className="flex flex-col gap-2">
          {options.map((opt, i) => (
            <button
              key={i}
              data-testid="choice-option"
              onClick={chooseAt(i)}
              className="text-left text-base px-4 py-3 bg-[#a5cbfd] text-ink-black rounded-xl border border-beige/20 text-beige hover:border-gold/50 hover:bg-gold/5 transition-colors"
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
