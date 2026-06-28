"use client";

import { formatText } from "../chat/helpers/formatText";

/** Narrator prose — no name, no avatar, distinct from a speech caption. */
export function VnNarration({ text }: { text: string }) {
  return (
    <p className="text-xl leading-relaxed italic text-[#d8cfd6] whitespace-pre-wrap">
      {formatText(text)}
    </p>
  );
}
