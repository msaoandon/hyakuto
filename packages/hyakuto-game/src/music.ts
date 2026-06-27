// Music is this game's presentation data (like character designs) — not part of
// the generic engine GameConfig. A *theme* is a list of folders under
// public/music/; the AudioProvider pools their tracks into one playlist
// (1 file loops, many rotate). Folders are referenced, never duplicated, so a
// shared track (e.g. the default melody) ships once and is pooled into many themes.
// A cue, by contrast, switches to its own folder only — it does not pool the
// default, so cue time plays the cue and nothing else.

export type MusicConfig = {
  /** Fallback chat playlist when a thread has no OST theme and no cue. */
  chatDefault: string[];
  /** Named themes (OST values authored in the `_threads` sheet) → folders to pool. */
  themes: Record<string, string[]>;
};

export const musicConfig: MusicConfig = {
  chatDefault: ["chat_default"],
  themes: {
    chat_day: ["chat_day", "chat_default"],
    chat_night: ["chat_night", "chat_default"],
  },
};

/**
 * This game's app-ambient rule: night from 18:00 to 06:00, day otherwise.
 * Returns the folder(s) to pool. Each game defines its own; the engine stays
 * unaware of time-of-day.
 */
export function pickAppMusic(date: Date): string[] {
  const hour = date.getHours();
  const isNight = hour >= 18 || hour < 6;
  return isNight ? ["app_night"] : ["app_default"];
}
