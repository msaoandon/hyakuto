'use client';

import { useState } from 'react';

type AvatarProps = {
  name: string;
};

export function Avatar({ name }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const src = `/avatars/${name.toLowerCase()}.jpg`;

  if (failed) {
    return (
      <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-xs font-bold text-dark-gray">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className="w-8 h-8 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
