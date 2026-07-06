import { loadGame } from "@/lib/game";
import { OstEditor } from "@/components/OstEditor";

export const dynamic = "force-dynamic";

export default async function OstPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const project = await loadGame(game);
  return <OstEditor gameId={game} themes={project.world.musicThemes} />;
}
