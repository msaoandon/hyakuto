import Link from "next/link";
import { loadGame } from "@/lib/game";

// A single game's overview: summary + entry points.
export const dynamic = "force-dynamic";

export default async function GameOverview({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const p = await loadGame(game);

  const stats: [string, number][] = [
    ["Characters", p.world.characters.length],
    ["Axes", p.world.axes.length],
    ["Counters", p.world.counters.length],
    ["Threads", p.threads.length],
    ["Days", p.days.length],
    ["Segments", p.segments.length],
    ["OST tracks", p.world.musicThemes.length],
  ];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-silver">{p.workspace.name}</h2>
        <p className="text-xs text-muted">{p.workspace.id} · locales: {p.workspace.locales.join(", ")}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded border border-edge bg-panel/40 p-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-xl text-silver">{n}</dd>
          </div>
        ))}
      </dl>

      <div className="flex gap-3">
        <Link href={`/g/${game}/world`} className="rounded border border-edge px-4 py-2 text-sm text-silver hover:bg-panel">
          World config →
        </Link>
        <Link href={`/g/${game}/ost`} className="rounded border border-edge px-4 py-2 text-sm text-silver hover:bg-panel">
          OST →
        </Link>
      </div>
    </section>
  );
}
