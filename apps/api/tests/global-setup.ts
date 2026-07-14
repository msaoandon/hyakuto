import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Fresh schema in a throwaway SQLite file before the suite. `db push` derives
// the tables straight from schema.prisma — tests always see the current shape.
export default function setup() {
  rmSync(".data/test.db", { force: true });
  execSync("pnpm exec prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: "file:../.data/test.db" },
    stdio: "pipe",
  });
}
