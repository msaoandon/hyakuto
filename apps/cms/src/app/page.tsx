import { getStore } from "@/lib/store";
import { InitProject } from "@/components/InitProject";
import { WorldConfigEditor } from "@/components/WorldConfigEditor";

// Server component: read the project directly from the store (no action needed for
// a read). If none exists yet, show the bootstrap screen; otherwise hand the world
// config to the client editor. `force-dynamic` because the store is on-disk state,
// not build-time data.
export const dynamic = "force-dynamic";

export default async function Home() {
  const store = getStore();
  if (!(await store.exists())) return <InitProject />;

  const project = await store.load();
  return <WorldConfigEditor workspace={project.workspace} world={project.world} />;
}
