// VN scene backgrounds — this game's presentation data, parallel to
// characterDesigns. A scene ID (authored as a `cue | scene | <id>` row) resolves
// to a background here. The engine never sees these; the VN renderer looks them
// up and crossfades between them. Image-backed scenes use `url(...)` in
// `background`; gradients/solids keep the bundle asset-free until art exists.

export type SceneDesign = {
  /** Any CSS `background` value: a solid colour, a gradient, or `url(/scenes/…)`. */
  background: string;
  /** Optional tint layered above the background for caption legibility. */
  overlay?: string;
};

export const sceneDesigns: Record<string, SceneDesign> = {
  bookshop: {
    background: "linear-gradient(160deg, #2a1d2e 0%, #3c2a33 55%, #1a1118 100%)",
    overlay: "rgba(0,0,0,0.25)",
  },
  street_night: {
    background: "linear-gradient(180deg, #0b1020 0%, #16223f 60%, #0a0d18 100%)",
    overlay: "rgba(0,0,0,0.35)",
  },
};

export const DEFAULT_SCENE: SceneDesign = {
  background: "linear-gradient(180deg, #14121a 0%, #0a090d 100%)",
  overlay: "rgba(0,0,0,0.3)",
};

export function getSceneDesign(scene: string | undefined): SceneDesign {
  if (!scene) return DEFAULT_SCENE;
  return sceneDesigns[scene] ?? DEFAULT_SCENE;
}
