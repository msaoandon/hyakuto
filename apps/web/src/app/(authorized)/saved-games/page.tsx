"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanternBackground } from "@/components/LanternBackground";
import { useGameStore } from "@/store/gameStore";
import { useT } from "@/i18n";
import { listSlots, type SlotMeta } from "@/data/authClient";

// Saved Games (DEV_PLAN Phase 3): switch between, start, or delete server save
// slots. Cloud saves only make sense once there's a durable account identity —
// a guest's IndexedDB save already IS "the" save on this device, so signed-out
// visitors get a sign-in prompt instead of an empty list. Reached from the
// lobby's "Load" tile (always visible — not gated there), so this page must
// render something coherent in every session state, not just return null.
export default function SavedGamesPage() {
  const t = useT();
  const router = useRouter();
  const session = useGameStore((s) => s.session);
  const currentSlot = useGameStore((s) => s.currentSlot);
  const locale = useGameStore((s) => s.locale);
  const loadSlot = useGameStore((s) => s.loadSlot);
  const startNewSlot = useGameStore((s) => s.startNewSlot);
  const deleteSlotAction = useGameStore((s) => s.deleteSlot);

  const signedIn = Boolean(session?.account);
  const [slots, setSlots] = useState<SlotMeta[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  useEffect(() => {
    if (!signedIn || !session) return;
    let cancelled = false;
    setSlots(null);
    setListFailed(false);
    listSlots(session.token)
      .then((list) => {
        if (!cancelled) setSlots(list);
      })
      .catch(() => {
        if (!cancelled) setListFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, session]);

  const startNew = async () => {
    setStarting(true);
    setStartFailed(false);
    try {
      await startNewSlot();
      router.replace("/welcome"); // a new slot has never been through the picker
    } catch (err) {
      console.warn("start new save failed:", err);
      setStarting(false);
      setStartFailed(true);
    }
  };

  const play = async (slot: number) => {
    await loadSlot(slot); // errors propagate to the row — it owns its own error state
    router.replace(useGameStore.getState().mcChosen ? "/lobby" : "/welcome");
  };

  const remove = async (slot: number) => {
    await deleteSlotAction(slot);
    setSlots((prev) => prev?.filter((s) => s.slot !== slot) ?? null);
  };

  return (
    <>
      <header className="shrink-0 text-lantern-blue px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center gap-3 bg-black/30">
        <Link href="/lobby" aria-label="back" className="text-xl leading-none">
          ←
        </Link>
        <span className="flex-1 truncate">{t("saves.title")}</span>
      </header>
      <div className="relative flex-1 flex flex-col gap-3 p-6 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <LanternBackground />

        {!signedIn ? (
          <div className="relative flex flex-col gap-3 rounded-xl bg-ink-black/40 px-4 py-3 text-beige">
            <span className="text-sm text-beige/70">{t("saves.signInRequired")}</span>
            <Link href="/settings" className="self-start text-sm text-lantern-blue hover:underline">
              {t("saves.goToSettings")}
            </Link>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={startNew}
              disabled={starting}
              className="rounded-xl px-4 py-3 text-left bg-navy-light/80 text-white border border-[#2f406d] hover:bg-navy-light disabled:opacity-50"
            >
              {starting ? t("account.connecting") : t("saves.new")}
            </button>
            {startFailed ? <span className="text-xs text-red-300">{t("saves.newError")}</span> : null}

            {slots === null ? (
              listFailed ? (
                <span className="text-sm text-red-300">{t("saves.listError")}</span>
              ) : (
                <span className="text-sm text-beige/50">{t("account.connecting")}</span>
              )
            ) : slots.length === 0 ? (
              <span className="text-sm text-beige/50">{t("saves.empty")}</span>
            ) : (
              slots.map((meta) => (
                <SlotRow
                  key={meta.slot}
                  meta={meta}
                  isCurrent={meta.slot === currentSlot}
                  locale={locale}
                  onPlay={play}
                  onDelete={remove}
                />
              ))
            )}
          </>
        )}
      </div>
    </>
  );
}

function SlotRow({
  meta,
  isCurrent,
  locale,
  onPlay,
  onDelete,
}: {
  meta: SlotMeta;
  isCurrent: boolean;
  locale: string;
  onPlay: (slot: number) => Promise<void>;
  onDelete: (slot: number) => Promise<void>;
}) {
  const t = useT();
  const [arming, setArming] = useState<"play" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<"play" | "delete" | null>(null);

  const arm = (mode: "play" | "delete") => () => {
    setFailed(null);
    setArming(mode);
  };
  const cancel = () => setArming(null);

  const confirmPlay = async () => {
    setPending(true);
    try {
      await onPlay(meta.slot);
    } catch (err) {
      console.warn("load save failed:", err);
      setPending(false);
      setFailed("play");
    }
  };
  const confirmDelete = async () => {
    setPending(true);
    try {
      await onDelete(meta.slot);
    } catch (err) {
      console.warn("delete save failed:", err);
      setPending(false);
      setFailed("delete");
      setArming(null);
    }
  };

  const updated = new Date(meta.updatedAt).toLocaleString(locale === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="relative flex flex-col gap-2 rounded-xl bg-ink-black/40 px-4 py-3 text-beige">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="tabular-nums">
            🕯 {meta.candles ?? 0} · {t("saves.completedThreads", { count: meta.completedThreads })}
          </span>
          <span className="text-xs text-beige/50">{updated}</span>
        </div>
        {isCurrent ? <span className="text-xs text-lantern-blue">{t("saves.current")}</span> : null}
      </div>

      {failed ? <span className="text-xs text-red-300">{t(failed === "play" ? "saves.playError" : "saves.deleteError")}</span> : null}

      {isCurrent ? null : arming === "play" ? (
        <span className="flex items-center gap-3">
          <span className="text-xs text-beige/50">{t("saves.playHint")}</span>
          <button type="button" onClick={confirmPlay} disabled={pending} className="text-lantern-blue hover:underline disabled:opacity-50">
            {pending ? t("account.connecting") : t("saves.playConfirm")}
          </button>
          <button type="button" onClick={cancel} className="text-beige/60 hover:text-beige">
            {t("settings.cancel")}
          </button>
        </span>
      ) : arming === "delete" ? (
        <span className="flex items-center gap-3">
          <span className="text-xs text-beige/50">{t("saves.deleteHint")}</span>
          <button type="button" onClick={confirmDelete} disabled={pending} className="text-red-300 hover:underline disabled:opacity-50">
            {pending ? t("account.connecting") : t("saves.deleteConfirm")}
          </button>
          <button type="button" onClick={cancel} className="text-beige/60 hover:text-beige">
            {t("settings.cancel")}
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-4">
          <button type="button" onClick={arm("play")} className="text-sm text-lantern-blue hover:underline">
            {t("saves.play")}
          </button>
          <button type="button" onClick={arm("delete")} className="text-sm text-red-300/80 hover:text-red-300 hover:underline">
            {t("saves.delete")}
          </button>
        </span>
      )}
    </div>
  );
}
