import { getCharacterDesign } from "@hyakuto/game";

type DecorProps = {
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

export function Decor({ character, image, className = 'w-[40px] h-[20px]' }: DecorProps) {
  const design = getCharacterDesign(character);

  return (
    <div
      className={className}
      style={{
        backgroundImage: `url('/assets/images/${image}')`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        opacity: 0.9
      }}
    />
  );
}
