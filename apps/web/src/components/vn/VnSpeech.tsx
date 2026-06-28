"use client";

import { getCharacterDesign } from "@hyakuto/game";
import { MC_NAME } from "../chat/helpers/mc";

/** A named character (or MC) speaking within a VN scene — a styled caption. */
export function VnSpeech({
  character,
  text,
  isMC,
}: {
  character: string;
  text: string;
  isMC: boolean;
}) {
  const design = getCharacterDesign(isMC ? "mc" : character);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-bold" style={{ color: design.textColor }}>
        {isMC ? MC_NAME : design.displayName}
      </span>
      <p className="text-xl leading-relaxed text-[#f0e9ee] whitespace-pre-wrap">{text}</p>
    </div>
  );
}
