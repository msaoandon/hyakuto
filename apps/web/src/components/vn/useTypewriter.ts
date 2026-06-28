"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Reveals `text` word-by-word for the VN reader. Keyed by `id` (not text) so two
 * consecutive lines with identical text still re-animate. `finish()` snaps to the
 * full text instantly (the Skip button / a Next press during reveal) — it must
 * also stop the timer, or the next tick would overwrite the snap and resume.
 */
export function useTypewriter(id: string, text: string, wordMs = 130) {
  // Split keeping whitespace as its own tokens, so join("") reconstructs exactly.
  const tokens = useMemo(() => (text ? text.split(/(\s+)/) : []), [text]);
  const [n, setN] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    setN(0);
    stop();
    if (tokens.length === 0) return;
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= tokens.length) stop();
    }, wordMs);
    return stop;
    // Reset per message, not per text value — identical successive lines re-run.
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = tokens.slice(0, n).join("");
  const done = n >= tokens.length;
  const finish = () => {
    stop(); // cancel the reveal so it can't tick back to partial
    setN(tokens.length);
  };

  return { shown, done, finish };
}
