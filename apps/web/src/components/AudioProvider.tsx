"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Howl } from "howler";
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
  const musicCue = useGameStore((s) => s.musicCue);

  const playlist = useRef<{ urls: string[]; idx: number; howl: Howl | null; key: string }>({
    urls: [],
    idx: 0,
    howl: null,
    key: "",
  });
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let folders: string[];
    if (thread) {
      const ost = manifest.threads[thread]?.ost;
      folders = musicCue ? foldersForTheme(musicCue) : ost ? foldersForTheme(ost) : musicConfig.chatDefault;
    } else {
      folders = pickAppMusic(new Date());
    }

    const urls = tracksForFolders(folders);
    const key = urls.join("|");
    if (key === playlist.current.key) return; // already on this set

    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => switchTo(urls, key), DEBOUNCE_MS);
    // switchTo/playTrack only read refs — not reactive deps
  }, [thread, musicCue]); // eslint-disable-line react-hooks/exhaustive-deps

  // crossfade from the current playlist to a new one
  function switchTo(urls: string[], key: string) {
    // unknown/empty theme (e.g. a mis-authored cue) → keep current music, don't go silent
    if (urls.length === 0) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[audio] theme resolved to no tracks — keeping current music");
      }
      return;
    }
    const old = playlist.current.howl;
    if (old) {
      old.fade(old.volume(), 0, CROSSFADE_MS);
      setTimeout(() => old.unload(), CROSSFADE_MS);
    }
    playlist.current = { urls, idx: 0, howl: null, key };
    playTrack(0, true);
  }

  function playTrack(idx: number, fadeIn: boolean) {
    const single = playlist.current.urls.length === 1;
    const howl = new Howl({
      src: [playlist.current.urls[idx]!],
      loop: single, // a one-track theme loops gaplessly; many rotate via onend
      volume: fadeIn ? 0 : 1,
      onend: () => {
        if (single) return;
        const next = (playlist.current.idx + 1) % playlist.current.urls.length;
        playlist.current.idx = next;
        playTrack(next, true);
      },
    });
    howl.play();
    if (fadeIn) howl.fade(0, 1, CROSSFADE_MS);
    playlist.current.howl = howl;
    playlist.current.idx = idx;
  }

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
      playlist.current.howl?.unload();
    },
    [],
  );

  return null;
}
