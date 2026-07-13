"use client";

import { useGameStore } from "@/store/gameStore";
import { useT, useMcName } from "@/i18n";

// The MC's face, shared by the lobby badge and the customisation fields: the
// uploaded avatar (object URL loaded post-hydration) or an initial-letter disc.
// Size comes in via className (w/h + text size for the initial).
export function McAvatar({ className = "w-16 h-16 text-xl" }: { className?: string }) {
  const t = useT();
  const avatarUrl = useGameStore((s) => s.mcAvatarUrl);
  const mcName = useMcName();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local blob URL
      <img
        src={avatarUrl}
        alt={t("mc.avatar")}
        className={`${className} rounded-full object-cover border border-[#2f406d]`}
      />
    );
  }
  return (
    <div
      className={`${className} rounded-full bg-navy-light/80 border border-[#2f406d] flex items-center justify-center font-bold text-beige`}
    >
      {mcName.charAt(0).toUpperCase()}
    </div>
  );
}
