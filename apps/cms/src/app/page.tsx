import Link from "next/link";
import { getCatalog } from "@/lib/store";
import { DeleteGame } from "@/components/DeleteGame";

// Home: the games list. The CMS manages many workspace-scoped games; each links
// into its own scoped area (/g/[id]/…). Reads the catalog directly (no action
// needed for a read); force-dynamic since it's on-disk state.
export const dynamic = "force-dynamic";

export default async function Home() {
  const games = await getCatalog().list();

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-silver">Games</h2>
          <p className="text-xs text-muted">Each game has its own world config, OST, and content.</p>
        </div>
        <Link
          href="/new"
          className="rounded border border-gold/60 bg-gold/10 px-4 py-2 text-sm text-gold hover:bg-gold/20"
        >
          + New game
        </Link>
      </div>

      {games.length === 0 ? (
        <p className="text-sm text-muted">
          No games yet. <Link href="/new" className="text-gold hover:underline">Create one</Link> to start.
        </p>
      ) : (
        <ul className="space-y-2">
          {games.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-3 rounded border border-edge bg-panel/40 p-3"
            >
              <Link href={`/g/${g.id}`} className="flex-1">
                <span className="text-sm text-silver">{g.name}</span>
                <span className="ml-2 text-xs text-muted">{g.id}</span>
              </Link>
              <Link href={`/g/${g.id}/world`} className="text-xs text-muted hover:text-silver">World</Link>
              <Link href={`/g/${g.id}/ost`} className="text-xs text-muted hover:text-silver">OST</Link>
              <DeleteGame id={g.id} name={g.name} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
