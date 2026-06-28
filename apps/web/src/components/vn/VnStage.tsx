"use client";

import { AnimatePresence, motion } from "framer-motion";
import { getSceneDesign, DEFAULT_SCENE } from "@hyakuto/game";

/**
 * Full-screen VN scene background. Crossfades when the scene changes (driven by
 * the `scene` cue, whose value is an image file name). Background only — the
 * dialogue box renders above it. A base gradient sits under the image so a
 * missing/unset file degrades gracefully instead of showing transparent.
 */
export function VnStage({ scene }: { scene?: string }) {
  const design = getSceneDesign(scene);
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: DEFAULT_SCENE.background }} />
      <AnimatePresence>
        <motion.div
          key={scene ?? "__default__"}
          className="absolute inset-0"
          style={{ background: design.background }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        />
      </AnimatePresence>
      {design.overlay && (
        <div className="absolute inset-0" style={{ background: design.overlay }} />
      )}
    </div>
  );
}
