// MC customisation primitives. Gender-for-address drives the `if_gender`
// context predicate. `unset` is the default, inclusive baseline — writers add
// male/female variants only where a line genuinely changes; the unset variant
// is the canonical line. The player-facing picker ships in Phase 3.

export type MCGender = 'male' | 'female' | 'unset';

export const MC_GENDERS: readonly MCGender[] = ['male', 'female', 'unset'];

export const DEFAULT_GENDER: MCGender = 'unset';

export function isMCGender(value: string): value is MCGender {
  return (MC_GENDERS as readonly string[]).includes(value);
}
