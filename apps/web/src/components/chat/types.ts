export type VisibleItem =
  | { kind: 'message'; character: string; text: string; isMC: boolean; isDev: boolean }
  | { kind: 'status'; text: string }
  | { kind: 'mc-reply'; text: string; isDev: boolean }
  | { kind: 'sticker'; character: string; file: string }
  | { kind: 'image'; character: string; file: string };
