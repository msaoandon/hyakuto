"use client";

import { useState } from "react";
import { getCharacterDesign } from "@hyakuto/game";

type AvatarProps = {
  name: string;
};

export function Avatar({ name }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const src = `/avatars/${name.toLowerCase()}.jpg`;
  const design = getCharacterDesign(name);

  if (failed) {
    return (
      <div
        className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-xs font-bold text-dark-gray"
        style={{ border: `1px solid ${design.borderColor}`, boxShadow: design.shadow }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className="w-10 h-10 rounded-full object-cover"
      style={{ border: `1px solid ${design.borderColor}`, boxShadow: design.shadow }}
      onError={() => setFailed(true)}
    />
  );
}
