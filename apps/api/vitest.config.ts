import { defineConfig } from "vitest/config";

// Tests run against a throwaway SQLite file (schema pushed by global-setup);
// the env block reaches the workers, so PrismaClient connects to the test db.
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "file:../.data/test.db",
      AUTH_SECRET: "test-secret-not-for-production",
    },
    globalSetup: "./tests/global-setup.ts",
    // One SQLite file, suites that count/wipe rows: files must not interleave.
    fileParallelism: false,
  },
});
