import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/store";

// Scopes everything under a single game. Validates the id and renders the
// game-scoped nav; a bad/deleted id 404s rather than rendering a broken area.
export const dynamic = "force-dynamic";

export default async function GameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  if (!(await getCatalog().has(game))) notFound();

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-4 text-xs text-muted">
        <Link href="/" className="hover:text-silver">← Games</Link>
        <span className="text-edge">/</span>
        <Link href={`/g/${game}`} className="hover:text-silver">Overview</Link>
        <Link href={`/g/${game}/world`} className="hover:text-silver">World config</Link>
        <Link href={`/g/${game}/story`} className="hover:text-silver">Story</Link>
        <Link href={`/g/${game}/ost`} className="hover:text-silver">OST</Link>
      </nav>
      {children}
    </div>
  );
}
