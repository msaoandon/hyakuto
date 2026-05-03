type AvatarProps = {
  name: string;
};

export function Avatar({ name }: AvatarProps) {
  const src = `/avatars/${name.toLowerCase()}.jpg`;

  return (
    <img
      src={src}
      alt={name}
      className="w-8 h-8 rounded-full object-cover"
      onError={(e) => {
        // Fallback to initial if image missing
        const el = e.currentTarget;
        el.style.display = "none";
        el.parentElement!.innerHTML = `
          <div class="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-xs font-bold text-dark-gray">
            ${name.charAt(0).toUpperCase()}
          </div>
        `;
      }}
    />
  );
}
