"use client";

import { useRef } from "react";
import type { MCGender } from "@hyakuto/engine";
import { useGameStore, MC_NAME_MAX, type McPronouns } from "@/store/gameStore";
import { useT, useMcName } from "@/i18n";
import { toAvatarBlob } from "./cropImage";

// The MC customisation fields (docs/worldbuilding/mc.md) — shared verbatim by
// the first-run /welcome step and the Settings section. Edits write straight
// through the store (no local draft): the same live-editing model as the rest
// of Settings. Address is framed as "how the others address you"; `unset` is a
// first-class option, listed first, never a missing answer.

const option =
  "rounded-xl px-4 py-3 text-left transition-colors border border-[#2f406d]";
const selected = "bg-navy-light/80 text-white";
const unselected = "bg-ink-black/30 text-beige/70 hover:bg-ink-black/50";

const GENDERS: { value: MCGender; label: "mc.addressUnset" | "mc.addressFemale" | "mc.addressMale" }[] = [
  { value: "unset", label: "mc.addressUnset" }, // the inclusive default, always first
  { value: "female", label: "mc.addressFemale" },
  { value: "male", label: "mc.addressMale" },
];

const PRONOUNS: McPronouns[] = ["they", "she", "he"];

export function McFields() {
  const t = useT();
  const mc = useGameStore((s) => s.mc);
  const gender = useGameStore((s) => s.save.gender ?? "unset");
  const avatarUrl = useGameStore((s) => s.mcAvatarUrl);
  const setMc = useGameStore((s) => s.setMc);
  const setMcAvatar = useGameStore((s) => s.setMcAvatar);
  const clearMcAvatar = useGameStore((s) => s.clearMcAvatar);
  const mcName = useMcName();
  const fileRef = useRef<HTMLInputElement>(null);

  const editName = (e: React.ChangeEvent<HTMLInputElement>) => setMc({ name: e.target.value });
  const pickGender = (value: MCGender) => () => setMc({ gender: value });
  const pickPronouns = (value: McPronouns) => () => setMc({ pronouns: value });
  const openFile = () => fileRef.current?.click();
  const removeAvatar = () => void clearMcAvatar();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    await setMcAvatar(await toAvatarBlob(file));
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => void onFile(e);

  return (
    <div className="flex flex-col gap-5">
      {/* Avatar (Option 1 surface: picker/Settings only — chat bubbles unchanged) */}
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL
          <img src={avatarUrl} alt={t("mc.avatar")} className="w-16 h-16 rounded-full object-cover border border-[#2f406d]" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-navy-light/80 border border-[#2f406d] flex items-center justify-center text-xl font-bold text-beige">
            {mcName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <button type="button" onClick={openFile} className="text-sm text-lantern-blue text-left hover:underline">
            {t("mc.avatarUpload")}
          </button>
          {avatarUrl && (
            <button type="button" onClick={removeAvatar} className="text-sm text-beige/50 text-left hover:underline">
              {t("mc.avatarRemove")}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange}
            className="hidden" data-testid="mc-avatar-input" />
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-beige/70">{t("mc.name")}</span>
        <input
          value={mc.name}
          onChange={editName}
          maxLength={MC_NAME_MAX}
          placeholder={t("mc.namePlaceholder")}
          className="rounded-xl bg-ink-black/40 border border-[#2f406d] px-4 py-3 text-beige outline-none focus:border-lantern-blue/70"
        />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm text-beige/70 mb-1.5">{t("mc.address")}</legend>
        {GENDERS.map(({ value, label }) => (
          <button key={value} type="button" onClick={pickGender(value)} aria-pressed={gender === value}
            className={`${option} ${gender === value ? selected : unselected}`}>
            {t(label)}
          </button>
        ))}
      </fieldset>

      <fieldset className="flex items-center gap-2">
        <legend className="text-sm text-beige/70 mb-1.5">{t("mc.pronouns")}</legend>
        {PRONOUNS.map((value) => (
          <button key={value} type="button" onClick={pickPronouns(value)} aria-pressed={mc.pronouns === value}
            className={`flex-1 rounded-xl px-3 py-2 text-center border border-[#2f406d] transition-colors ${mc.pronouns === value ? selected : unselected}`}>
            {t(`mc.pronouns.${value}`)}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
