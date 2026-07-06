import { loadGame } from "@/lib/game";
import { StoryTree } from "@/components/StoryTree";

// Story structure: the Day → Thread → Segment tree (DEV_PLAN_CMS Slice 3). The
// server flattens the project into the light shapes the tree needs; all editing
// happens through the story server actions.
export const dynamic = "force-dynamic";

export default async function StoryPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const p = await loadGame(game);
  const dl = p.workspace.defaultLocale;

  const days = [...p.days]
    .sort((a, b) => a.route.localeCompare(b.route) || a.index - b.index)
    .map((d) => ({ id: d.id, index: d.index, route: d.route, segmentIds: [...d.segmentIds] }));

  const segments = Object.fromEntries(
    p.segments.map((s) => [s.id, { threadId: s.threadId ?? null, lineCount: s.lines.length }]),
  );

  const threads = p.threads.map((t) => ({
    id: t.id,
    kind: t.kind,
    name: t.display_name.text[dl] ?? t.id,
    contact: t.contact ?? null,
    segmentCount: p.segments.filter((s) => s.threadId === t.id).length,
  }));

  return (
    <StoryTree
      gameId={game}
      days={days}
      segments={segments}
      threads={threads}
      characters={p.world.characters.map((c) => c.id)}
    />
  );
}
