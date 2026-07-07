export type Locale = "en" | "uk";
export const SUPPORTED_LOCALES: Locale[] = ["en", "uk"];
export const DEFAULT_LOCALE: Locale = "en";

/** Best supported match for the device's preferred language tags, in preference
 *  order ("uk-UA" → "uk"). Undefined when nothing matches — the caller keeps the
 *  current locale rather than falling back here, so "no match" changes nothing. */
export function matchDeviceLocale(tags: readonly string[]): Locale | undefined {
  for (const tag of tags) {
    const base = tag.toLowerCase().split("-")[0];
    const match = SUPPORTED_LOCALES.find((l) => l === base);
    if (match) return match;
  }
  return undefined;
}
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "ENG",
  uk: "UKR",
};
