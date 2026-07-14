import { defineConfig } from "vitest/config";

// Tests run against a throwaway SQLite file (schema pushed by global-setup);
// the env block reaches the workers, so PrismaClient connects to the test db.
export default defineConfig({
  test: {
    env: { DATABASE_URL: "file:../.data/test.db" },
    globalSetup: "./tests/global-setup.ts",
  },
});
