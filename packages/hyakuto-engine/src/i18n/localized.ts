import { z } from 'zod';

// Content localization primitive. A translatable value is authored either as a
// plain string (language-neutral, or legacy single-language content) or as a
// locale→text map ({ en, uk, … }) — the form the exporter emits from parallel
// `*_<locale>` columns. Resolution to the active language happens once, at the
// convert/assemble seam, so the engine plays plain strings and stays
// locale-agnostic at play time. Locale codes are open (any string); the engine
// never enumerates them.

export const DEFAULT_LOCALE = 'en';

export const Localized = z.union([z.string(), z.record(z.string(), z.string())]);
export type Localized = z.infer<typeof Localized>;

/**
 * Flatten a Localized to the active language. A plain string passes through. A
 * map resolves to the requested locale, then the fallback locale (default
 * `en`), then any present value — so a missing translation degrades to the
 * canonical line rather than rendering blank.
 */
export function resolveLocale(value: Localized, locale: string, fallback = DEFAULT_LOCALE): string {
  if (typeof value === 'string') return value;
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? '';
}

/** All text values carried by a Localized — for build-time checks (e.g. empty). */
export function localizedValues(value: Localized): string[] {
  return typeof value === 'string' ? [value] : Object.values(value);
}
