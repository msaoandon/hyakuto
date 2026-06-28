// VN scene backgrounds. A scene is set by an inline `cue | scene | <file>` row;
// the cue value is the image file name, served from /public/scenes/. This mirrors
// the `image` content type (`file` → /images/<file>) — no per-scene registration.
//
// Use a full filename including extension, e.g. "bookshop.jpg". Any format the
// WebView supports works (webp/jpg/png/avif). Since the app is statically
// exported there's no image optimization — size/compress the files yourself.

export type SceneDesign = {
  /** A CSS `background` value (an image url, or the default gradient). */
  background: string;
  /** Tint layered above the background for caption legibility. */
  overlay?: string;
};

/** Folder under /public where scene art lives. */
export const SCENES_DIR = "/scenes";

/** Shown when a scene has no image set (or the file fails to load). */
export const DEFAULT_SCENE: SceneDesign = {
  background: "linear-gradient(180deg, #14121a 0%, #0a090d 100%)",
  overlay: "rgba(0,0,0,0.3)",
};

/** Resolve a scene cue value (an image file name) to a background. */
export function getSceneDesign(file?: string): SceneDesign {
  if (!file) return DEFAULT_SCENE;
  return {
    background: `url(${SCENES_DIR}/${file}) center / cover no-repeat`,
    overlay: DEFAULT_SCENE.overlay,
  };
}
