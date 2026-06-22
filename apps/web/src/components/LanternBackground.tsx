import styles from "./LanternBackground.module.css";

/** Decorative, non-interactive backdrop for the main screen.
 *  Static placeholder art for now — the animated CSS scene was too heavy. */
export function LanternBackground() {
  return <div className={styles.scene} aria-hidden="true" />;
}
