import { en } from "./en";
import { uk } from "./uk";
import { type Locale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from "./locales";
import { useGameStore } from "@/store/gameStore";

export { type Locale, SUPPORTED_LOCALES, DEFAULT_LOCALE };

export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;
const dictionaries: Record<Locale, Messages> = { en, uk };

/** The active locale, reactive — for both UI dictionaries and content resolution
 *  (display names, message text) at the engine assemble seam. */
export function useLocale(): Locale {
  return useGameStore((s) => s.locale);   // reactive — UI re-renders when locale changes
}

type Vars = Record<string, string | number>;
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function useT() {
  const dict = dictionaries[useLocale()];
  return (key: MessageKey, vars?: Vars): string => interpolate(dict[key], vars);
}

/** MC display name: the player's chosen name, or the localized default ("You").
 *  Reactive to both the name and the locale. */
export function useMcName(): string {
  const name = useGameStore((s) => s.mc.name);
  const dict = dictionaries[useLocale()];
  return name.trim() || dict["mc.defaultName"];
}
