// The `{MC}` / `{@MC}` authoring tokens resolve to the player's chosen name at
// RENDER time (never baked into saved state), so renaming is retroactive across
// the whole story. The name comes from the store via useMcName() (i18n), which
// falls back to the localized default ("You"/"Ти") when unset.

/** Replace `{MC}` / `{@MC}` authoring tokens with the player's display name. */
export function substituteMC(text: string, name: string): string {
  return text.replace(/\{@?MC\}/g, name);
}
