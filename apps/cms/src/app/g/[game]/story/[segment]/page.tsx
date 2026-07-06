import { notFound } from "next/navigation";
import { loadGame } from "@/lib/game";
import { SegmentEditor } from "@/components/SegmentEditor";

// One segment's authoring grid (DEV_PLAN_CMS §VI.3). The server resolves the
// segment plus everything the grid's dropdowns need from the world config; the
// grid autosaves through the saveSegment action.
export const dynamic = "force-dynamic";

export default async function SegmentPage({ params }: { params: Promise<{ game: string; segment: string }> }) {
  const { game, segment: rawId } = await params;
  const segmentId = decodeURIComponent(rawId);

  const p = await loadGame(game);
  const segment = p.segments.find((s) => s.id === segmentId);
  if (!segment) notFound();

  const dl = p.workspace.defaultLocale;
  const thread = segment.threadId ? p.threads.find((t) => t.id === segment.threadId) : undefined;
  const day = p.days.find((d) => d.segmentIds.includes(segmentId));

  return (
    <SegmentEditor
      gameId={game}
      segment={segment}
      defaultLocale={dl}
      world={p.world}
      context={{
        kind: thread?.kind ?? "system",
        threadName: thread ? (thread.display_name.text[dl] ?? thread.id) : null,
        dayLabel: day ? `Day ${day.index} · ${day.route}` : "not in any day",
      }}
    />
  );
}
