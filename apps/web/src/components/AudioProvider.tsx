"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { musicConfig, pickAppMusic } from "@hyakuto/game";
import { useGameStore } from "@/store/gameStore";
import musicIndexData from "@/data/musicIndex.json";
import manifestData from "@/data/manifest.json";
import type { Manifest } from "@hyakuto/engine";

const manifest = manifestData as Manifest;
const musicIndex = musicIndexData as Record<string, string[]>;

const CROSSFADE_MS = 1200;
const DEBOUNCE_MS = 200; // coalesce cue bursts (fast pace / catch-up) into one switch

// A theme resolves to folders: a named theme expands to its folder list,
// otherwise the value is treated as a single folder name.
function foldersForTheme(theme: string): string[] {
  return musicConfig.themes[theme] ?? [theme];
}

// folders → flat list of track URLs from the build-time index
function tracksForFolders(folders: string[]): string[] {
  return folders.flatMap((folder) =>
    (musicIndex[folder] ?? []).map((file) => `/music/${folder}/${file}`),
  );
}

// One playing playlist: an <audio> element (loads under Capacitor's capacitor://
// scheme, where Web Audio's XHR fetch fails) routed through a GainNode so we can
// fade it — iOS ignores volume changes on the element itself, but not on the node.
type Deck = { audio: HTMLAudioElement; gain: GainNode; urls: string[]; idx: number; key: string };

/**
 * Plays background music with no UI. Resolution:
 *   in a chat → music cue ▸ thread OST ▸ chatDefault
 *   elsewhere → pickAppMusic(now)
 * Each resolves to a theme → folders → a playlist (one track loops, many rotate).
 * Mounted once at the root so music continues across navigation.
 */
export function AudioProvider() {
  // useParams() is unreliable for nested dynamic params from the root layout;
  // usePathname() always gives the full URL. Chat route: /play/day/<day>/<thread>
  const pathname = usePathname();
  const thread = pathname.match(/^\/play\/day\/[^/]+\/([^/]+)\/?$/)?.[1] ?? null;
  // select only the music channel — a glitch cue changing cues.glitch won't re-render here.
  // "base" is the revert token: it means "back to the chat's base playlist", i.e. no override.
  const rawCue = useGameStore((s) => s.cues.music);
  const musicCue = rawCue && rawCue !== "base" ? rawCue : null;

  const ctxRef = useRef<AudioContext | null>(null);
  const deck = useRef<Deck | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getCtx(): AudioContext {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctor();
    }
    return ctxRef.current;
  }

  // iOS/WKWebView blocks audio until a user gesture and starts the audio context
  // "suspended". Create + resume it inside the first tap, then begin playback.
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    if (unlocked) return;
    const unlock = () => {
      const ctx = getCtx();
      if (ctx.state !== "running") void ctx.resume();
      setUnlocked(true);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("touchend", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchend", unlock);
    };
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return; // can't start before the gesture unlocks audio on iOS

    let folders: string[];
    if (thread) {
      const ost = manifest.threads[thread]?.ost;
      folders = musicCue ? foldersForTheme(musicCue) : ost ? foldersForTheme(ost) : musicConfig.chatDefault;
    } else {
      folders = pickAppMusic(new Date());
    }

    const urls = tracksForFolders(folders);
    const key = urls.join("|");
    if (key === deck.current?.key) return; // already on this set

    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => switchTo(urls, key), DEBOUNCE_MS);
    // switchTo reads refs — not reactive deps
  }, [thread, musicCue, unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // linear gain ramp from the current value to `to` over the crossfade window
  function ramp(gain: GainNode, to: number) {
    const now = getCtx().currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + CROSSFADE_MS / 1000);
  }

  function teardown(d: Deck) {
    ramp(d.gain, 0);
    setTimeout(() => {
      d.audio.pause();
      d.audio.removeAttribute("src");
      d.gain.disconnect();
    }, CROSSFADE_MS);
  }

  // crossfade from the current playlist to a new one
  function switchTo(urls: string[], key: string) {
    // unknown/empty theme (e.g. a mis-authored cue) → keep current music, don't go silent
    if (urls.length === 0) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[audio] theme resolved to no tracks — keeping current music");
      }
      return;
    }

    const ctx = getCtx();
    if (deck.current) teardown(deck.current);

    const audio = new Audio();
    audio.preload = "auto";
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(ctx.destination);

    const d: Deck = { audio, gain, urls, idx: 0, key };
    deck.current = d;

    const single = urls.length === 1;
    audio.loop = single; // one track loops; many rotate via "ended"
    if (!single) {
      audio.addEventListener("ended", () => {
        d.idx = (d.idx + 1) % d.urls.length;
        d.audio.src = d.urls[d.idx]!;
        void d.audio.play().catch(() => {});
      });
    }
    audio.addEventListener("error", () =>
      console.warn(`[audio] failed to load ${audio.src}`, audio.error),
    );

    audio.src = urls[0]!;
    void audio.play().catch(() => {});
    ramp(gain, 1);
  }

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
      if (deck.current) {
        deck.current.audio.pause();
        deck.current.gain.disconnect();
      }
    },
    [],
  );

  return null;
}
