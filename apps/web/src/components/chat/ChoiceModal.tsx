// components/chat/ChoiceModal.tsx
'use client';

type ChoiceModalProps = {
  options: { text: string }[];
  onChoose: (index: number) => void;
  onClose: () => void;
};

export function ChoiceModal({ options, onChoose, onClose }: ChoiceModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80" />
      <div
        className="relative w-full max-w-lg bg-dark-gray rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-beige/20 rounded-full mx-auto mb-4" />
        <div className="flex flex-col gap-2">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onChoose(i)}
              className="text-left text-sm px-4 py-3 bg-lavelnder-veil text-ink-black rounded-xl border border-beige/20 text-beige hover:border-gold/50 hover:bg-gold/5 transition-colors"
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
