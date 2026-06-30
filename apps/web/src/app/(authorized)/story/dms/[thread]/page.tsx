import { dmThreadIds } from "@/data/loadDay";
import { DmView } from "./DmView";

// `output: export` requires a dynamic route to emit at least one param. A game
// may legitimately have no DMs yet (none authored), so when there are none we
// emit a single unreachable placeholder — the inbox never links it, and DmView
// renders a graceful empty state for it. Keeps builds green with or without DMs.
const DM_PLACEHOLDER = "__none__";

export function generateStaticParams() {
  const ids = dmThreadIds();
  return (ids.length ? ids : [DM_PLACEHOLDER]).map((thread) => ({ thread }));
}

export default async function Page({ params }: { params: Promise<{ thread: string }> }) {
  const { thread } = await params;
  return <DmView thread={thread} />;
}
