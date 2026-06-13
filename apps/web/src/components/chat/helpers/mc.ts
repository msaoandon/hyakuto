// The display name shown in place of the player-character authoring token.
export const MC_NAME = "You";

/** Replace `{MC}` / `{@MC}` authoring tokens with the player's display name. */
export function substituteMC(text: string): string {
  return text.replace(/\{@?MC\}/g, MC_NAME);
}
