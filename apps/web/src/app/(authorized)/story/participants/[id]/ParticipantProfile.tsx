"use client";

import { getCharacterDesign } from "@hyakuto/game";
import { Avatar } from "@/components/chat/Avatar";
import { StoryHeader } from "@/components/layout/StoryHeader";
import { LanternBackground } from "@/components/LanternBackground";

// A participant's profile, opened from the hub avatar row. Phase A shows the
// avatar and name; bio text and per-character affinity arrive with that data
// model (gameConfig has only global axes today).
export function ParticipantProfile({ id }: { id: string }) {
  const design = getCharacterDesign(id);

  return (
    <>
      <StoryHeader back="/story" title={design.displayName} />
      <div className="flex-1 flex flex-col items-center gap-6 p-8">
        <LanternBackground />
        <div className="scale-[2.2] mt-6">
          <Avatar name={id} />
        </div>
        <h1 className="mt-6 text-2xl font-semibold" style={{ color: design.textColor }}>
          {design.displayName}
        </h1>
        <p className="text-silver/60 text-sm text-center max-w-xs">
          {/* Bio + affinity pending the per-character data model. */}
          ⸻
        </p>
      </div>
    </>
  );
}
