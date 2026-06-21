import styles from "./LanternBackground.module.css";

type Lantern = {
  shape: "circle" | "rect";
  left: string;
  top: string;
  w: number;
  h: number;
  string: number; // string length in px, up toward the screen top
  sway: number; // peak rotation in degrees, ± from center
  dur: number; // sway period (s)
  glowDur: number; // glow pulse period (s)
  delay: number; // animation offset (s) so lanterns don't move in lockstep
  opacity: number; // 0–1, for a sense of depth (nearer = more opaque)
};

// Seven lanterns scattered across the upper half — a mix of round and tall
// rounded-rect shapes, each with its own timing so the cluster breathes.
const LANTERNS: Lantern[] = [
  { shape: "circle", left: "5%", top: "14%", w: 124, h: 114, string: 60, sway: 5, dur: 7, glowDur: 4.5, delay: 0, opacity: 1 },
  { shape: "rect", left: "26%", top: "8%", w: 46, h: 70, string: 90, sway: 4, dur: 8.5, glowDur: 5.2, delay: 1.1, opacity: 0.55 },
  { shape: "circle", left: "40%", top: "20%", w: 92, h: 84, string: 45, sway: 6, dur: 6.5, glowDur: 4, delay: 2.3, opacity: 0.85 },
  { shape: "rect", left: "55%", top: "11%", w: 50, h: 76, string: 75, sway: 4.5, dur: 9, glowDur: 5.8, delay: 0.6, opacity: 0.65 },
  { shape: "circle", left: "70%", top: "18%", w: 78, h: 70, string: 55, sway: 5.5, dur: 7.5, glowDur: 4.3, delay: 1.8, opacity: 0.9 },
  { shape: "rect", left: "84%", top: "9%", w: 42, h: 64, string: 85, sway: 4, dur: 8, glowDur: 5, delay: 3.1, opacity: 0.5 },
  { shape: "circle", left: "92%", top: "22%", w: 58, h: 52, string: 40, sway: 6, dur: 6.8, glowDur: 4.6, delay: 2.6, opacity: 0.55 },
];

// Mist layers drifting across the lower half. Two variants moving against each
// other: "base" crawls right-and-down, "alt" the opposite way with an upward creep.
const MIST: { variant: "base" | "alt"; dur: number; delay: number }[] = [
  { variant: "base", dur: 14, delay: 0 },
  { variant: "base", dur: 24, delay: 5 },
  { variant: "alt", dur: 19, delay: 2 },
  { variant: "alt", dur: 30, delay: 7 },
];

/** Decorative, non-interactive backdrop for the main screen. */
export function LanternBackground() {
  return (
    <div className={styles.scene} aria-hidden="true">
      {LANTERNS.map((l, i) => (
        <div
          key={i}
          className={styles.lantern}
          style={
            {
              left: l.left,
              top: l.top,
              opacity: l.opacity,
              "--string": `${l.string}px`,
              "--sway": l.sway,
              "--dur": `${l.dur}s`,
              "--delay": `${l.delay}s`,
            } as React.CSSProperties
          }
        >
          <div
            className={`${styles.body} ${l.shape === "circle" ? styles.circle : styles.rect}`}
            style={
              {
                "--w": `${l.w}px`,
                "--h": `${l.h}px`,
                "--glow-dur": `${l.glowDur}s`,
                "--delay": `${l.delay}s`,
              } as React.CSSProperties
            }
          />
        </div>
      ))}
      {MIST.map((m, i) => (
        <div
          key={i}
          className={m.variant === "alt" ? styles.mistAlt : styles.mist}
          style={{ "--dur": `${m.dur}s`, "--delay": `${m.delay}s` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
