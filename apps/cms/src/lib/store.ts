import "server-only";
import { join, isAbsolute } from "node:path";
import { FileProjectStore, type ProjectStore } from "@hyakuto/cms-core";

// Resolve the project store for the running CMS instance. The location is the
// configurable, gitignored `CMS_DATA_DIR` (DEV_PLAN_CMS §IV) — "local now",
// "on an author's machine", and "hosted backend" are the same seam at a different
// path. Default: `<apps/cms>/.data` (gitignored). `server-only` guarantees this
// module — and the node:fs it pulls in — never leaks into a client bundle.
export function getStore(): ProjectStore {
  const configured = process.env.CMS_DATA_DIR;
  const root = configured
    ? isAbsolute(configured)
      ? configured
      : join(process.cwd(), configured)
    : join(process.cwd(), ".data");
  return new FileProjectStore(root);
}
