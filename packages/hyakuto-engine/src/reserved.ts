// Reserved character IDs the engine registers automatically — they need no
// entry in a game's character config. `narrator` is the VN prose voice (no
// avatar/name); `MC` is the player; `dev` is the debug speaker.
export const NARRATOR = "narrator";

/** Character IDs valid everywhere without a game-config entry. */
export const RESERVED_CHARACTERS = ["MC", "dev", NARRATOR] as const;
