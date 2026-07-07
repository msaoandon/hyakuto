'use client';

type ChoiceOption = {
  text: string;
  effects?: { axis: string; delta: number }[];
};

type ChoiceGroupProps = {
  options: ChoiceOption[];
  onChoose: (index: number) => void;
  disabled?: boolean;
  chosenIndex?: number;
};

export function ChoiceGroup({ options, onChoose, disabled = false, chosenIndex }: ChoiceGroupProps) {
  const chooseAt = (i: number) => () => onChoose(i);
  return (
    <div className="flex flex-col gap-2 py-2 px-4">
      {options.map((opt, i) => {
        const isChosen = chosenIndex === i;
        return (
          <button
            key={i}
            onClick={chooseAt(i)}
            disabled={disabled}
            className={`text-left text-base px-4 py-3 rounded-xl border transition-colors
              ${isChosen
                ? 'border-gold bg-gold/20 text-gold'
                : disabled
                  ? 'border-beige/10 text-beige/30'
                  : 'border-beige/20 text-beige hover:border-gold/50 hover:bg-gold/5'
              }`}
          >
            {opt.text}
          </button>
        );
      })}
    </div>
  );
}
