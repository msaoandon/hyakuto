import { z } from 'zod';
import type { Localized } from '@hyakuto/engine';

// ─── TRANSLATABLE UNIT (§III.5) ──────────────────────────────────────────────
// Every translatable string in the project — a message bubble, a pool variant, a
// choice-option label, a thread display name — is its own id-addressed unit. Two
// reasons this is load-bearing and baked in from the first commit:
//
//   1. Round-trip translation (a backlog feature): export every unit by id +
//      source + per-locale columns, translate, import back *by id*. That only
//      works if each string has a stable id independent of its position or
//      wording — retrofitting ids onto existing content is brutal.
//   2. Stale tracking: when the source text changes, its translations are marked
//      stale rather than silently kept. `staleLocales` carries that flag.
//
// It compiles down to the engine's `Localized` (plain string | locale→text map)
// at the seam, so the engine never sees a unit id and stays locale-agnostic.

export const LocaleCode = z.string().min(1);

export const TranslatableUnit = z.object({
  /** Stable, position/wording-independent id — the translation round-trip key. */
  id: z.string().min(1),
  /** locale → text. Must carry the project's default locale (enforced in validation). */
  text: z.record(LocaleCode, z.string()),
  /** Locales whose translation is stale vs the current source text (advisory). */
  staleLocales: z.array(LocaleCode).optional(),
});

export type LocaleCode = z.infer<typeof LocaleCode>;
export type TranslatableUnit = z.infer<typeof TranslatableUnit>;

/**
 * Flatten a unit to the engine's `Localized`. Emits a **plain string** when the
 * only text present is the default locale (matching the exporter's back-compat
 * behaviour — a row with no translation siblings becomes a bare string), else a
 * locale→text map. Resolution to the active language stays the engine's job.
 */
export function compileLocalized(unit: TranslatableUnit, defaultLocale: string): Localized {
  const locales = Object.keys(unit.text);
  if (locales.length === 1 && locales[0] === defaultLocale) return unit.text[defaultLocale];
  return { ...unit.text };
}

/** Build a unit from an engine `Localized` value (used by the importer). A plain
 *  string becomes `{ [defaultLocale]: value }`; a map is carried through. */
export function unitFromLocalized(value: Localized, id: string, defaultLocale: string): TranslatableUnit {
  const text = typeof value === 'string' ? { [defaultLocale]: value } : { ...value };
  return { id, text };
}

/** A fresh unit holding only default-locale text (what the grid mints per line). */
export function newUnit(id: string, defaultLocale: string, text = ''): TranslatableUnit {
  return { id, text: { [defaultLocale]: text } };
}

/**
 * Author edits the source text (§III.5): write the default locale and mark every
 * *other* locale carried by the unit stale — a changed source never silently keeps
 * its old translations. No-op when the text is unchanged, so a focus/blur cycle
 * doesn't flag anything.
 */
export function editUnitText(unit: TranslatableUnit, text: string, defaultLocale: string): TranslatableUnit {
  if (unit.text[defaultLocale] === text) return unit;
  const stale = new Set([
    ...(unit.staleLocales ?? []),
    ...Object.keys(unit.text).filter((locale) => locale !== defaultLocale),
  ]);
  return {
    ...unit,
    text: { ...unit.text, [defaultLocale]: text },
    ...(stale.size ? { staleLocales: [...stale] } : {}),
  };
}
