import { getCharacterDesign } from "@hyakuto/game";

type MaskedDecorProps = {
  character: string;
  image?: string;
  className?: string;
};

export function MaskedDecor({ character, image, className = 'w-[40px] h-[20px]' }: MaskedDecorProps) {
  const design = getCharacterDesign(character);

  return (
    <div
      className={className}
      style={{
        backgroundColor: design.borderColor,
        maskImage: `url('/assets/images/${image}')`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskImage: `url('/assets/images/${image}')`,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        opacity: 0.9
      }}
    />
  );
}
