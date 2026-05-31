import { getCharacterDesign } from "@hyakuto/game";

type MaskedDecorProps = {
  character: string;
  image?: string;
  className?: string;
};

const colorMap: Record<string, string> = {
  tatsumi: '#81B6F8',
  kou: "#F9AA5A",
  ren: "#C9BDCD",
  haruki: "#C8DE98"
}

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
