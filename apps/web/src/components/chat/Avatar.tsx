type AvatarProps = {
  name: string;
  color?: string;
};

export function Avatar({ name, color = '#ffbd59' }: AvatarProps) {
  return (
    <div
      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
      style={{ backgroundColor: color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
