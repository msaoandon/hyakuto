export type VisibleItem =
  | { kind: 'message'; character: string; text: string; isMC: boolean; isDev: boolean }
  | { kind: 'status'; text: string }
  | { kind: 'mc-reply'; text: string; isDev: boolean }
  | { kind: 'sticker'; character: string; file: string }
  | { kind: 'image'; character: string; file: string };

/** A choice surfaced by the engine, awaiting the player's reply. */
export type PendingChoice = {
  options: { text: string }[];
  character?: string;
};

/** A flat snapshot of engine state for the dev console / candle UI. */
export type EngineSnapshot = {
  axes: Record<string, number>;
  counters: Record<string, number>;
  flags: string[];
};
