"use client";

import { useGameStore } from "@/store/gameStore";
import { SUPPORTED_LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/locales";

export function LanguageChooser() {
  const locale = useGameStore((s) => s.locale);
  const setLocale = useGameStore((s) => s.setLocale);

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label="Language"
      className="rounded bg-[#cec0c4] text-ink-black px-3 py-1"
    >
      {SUPPORTED_LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_NAMES[l]}
        </option>
      ))}
    </select>
  );
}
