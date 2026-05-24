type MaskedDecorProps = {
  character: string;
  className?: string;
};

const colorMap: Record<string, string> = {
  tatsumi: '#81B6F8',
  kou: "#F9AA5A",
  ren: "#C9BDCD",
  haruki: "#C8DE98"
}

export function MaskedDecor({ character, className = 'w-24 h-9' }: MaskedDecorProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: colorMap[character.toLowerCase()],
        maskImage: `url('/assets/images/${character.toLowerCase()}.png')`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        position: 'absolute',
        left: -5,
        bottom: -5,
        WebkitMaskImage: `url('/assets/images/${character.toLowerCase()}.png')`,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        opacity: 0.2
      }}
    />
  );
}
