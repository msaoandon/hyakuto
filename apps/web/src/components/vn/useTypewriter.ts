"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Reveals `text` word-by-word for the VN reader. Keyed by `id` (not text) so two
 * consecutive lines with identical text still re-animate. `finish()` snaps to the
 * full text instantly (the Skip button / a Next press during reveal).
 */
export function useTypewriter(id: string, text: string, wordMs = 55) {
  // Split keeping whitespace as its own tokens, so join("") reconstructs exactly.
  const tokens = useMemo(() => (text ? text.split(/(\s+)/) : []), [text]);
  const [n, setN] = useState(0);

  useEffect(() => {
    setN(0);
    if (tokens.length === 0) return;
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= tokens.length) clearInterval(timer);
    }, wordMs);
    return () => clearInterval(timer);
    // Reset per message, not per text value — identical successive lines re-run.
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = tokens.slice(0, n).join("");
  const done = n >= tokens.length;
  const finish = () => setN(tokens.length);

  return { shown, done, finish };
}
