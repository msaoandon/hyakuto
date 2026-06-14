import { en } from "./en";
import { uk } from "./uk";

export type Locale = "en" | "uk";

/** The full message-key set; every locale must provide all of these. */
export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

// Typing each entry as Messages makes a missing key in any locale a COMPILE error
// — locale parity is enforced here, not only by the runtime test.
const dictionaries: Record<Locale, Messages> = { en, uk };

export const SUPPORTED_LOCALES: Locale[] = ["en", "uk"];
export const DEFAULT_LOCALE: Locale = "en";

// TODO(#2 store): read the active locale from the game store (device-defaulted).
// Isolating the source here means useT() consumers never change when the store lands.
function useLocale(): Locale {
  return DEFAULT_LOCALE;
}

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Translate a key for the active locale, with optional `{name}` interpolation. */
export function useT() {
  const dict = dictionaries[useLocale()];
  return (key: MessageKey, vars?: Vars): string => interpolate(dict[key], vars);
}
