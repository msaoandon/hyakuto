"use client";

/** The MC answer chooser, rendered over the scene in place of the controls. */
export function VnChoices({
  options,
  onChoose,
}: {
  options: { text: string }[];
  onChoose: (index: number) => void;
}) {
  const chooseAt = (i: number) => () => onChoose(i);
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, i) => (
        <button
          key={i}
          data-testid="vn-choice-option"
          onClick={chooseAt(i)}
          className="text-left text-base px-4 py-3 rounded-xl border border-[#2f406d] bg-[#162347]/80 text-[#daccd0] hover:bg-[#2f406d]/80 transition-colors"
        >
          {opt.text}
        </button>
      ))}
    </div>
  );
}
