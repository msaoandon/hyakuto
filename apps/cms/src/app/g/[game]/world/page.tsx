import { loadGame } from "@/lib/game";
import { WorldConfigEditor } from "@/components/WorldConfigEditor";

export const dynamic = "force-dynamic";

export default async function WorldPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const project = await loadGame(game);
  return <WorldConfigEditor gameId={game} workspace={project.workspace} world={project.world} />;
}
