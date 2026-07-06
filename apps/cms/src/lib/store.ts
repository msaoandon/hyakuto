import "server-only";
import { join, isAbsolute } from "node:path";
import { FileWorkspaceCatalog, type WorkspaceCatalog } from "@hyakuto/cms-core";

// Resolve the workspace catalog for the running CMS instance. The location is the
// configurable, gitignored `CMS_DATA_DIR` (DEV_PLAN_CMS §IV); each game lives in
// its own folder underneath. Default: `<apps/cms>/.data`. `server-only` keeps this
// module — and the node:fs it pulls in — out of any client bundle.
function dataRoot(): string {
  const configured = process.env.CMS_DATA_DIR;
  if (!configured) return join(process.cwd(), ".data");
  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

export function getCatalog(): WorkspaceCatalog {
  return new FileWorkspaceCatalog(dataRoot());
}
