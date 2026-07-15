import { defineConfig } from "vitest/config";

// Tests run against a throwaway SQLite file (schema pushed by global-setup);
// the env block reaches the workers, so PrismaClient connects to the test db.
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "file:../.data/test.db",
      AUTH_SECRET: "test-secret-not-for-production",
      // Explicitly blank, overriding whatever a developer's local .env has:
      // which providers are "configured" must be deterministic in tests,
      // never dependent on ambient state (Vitest loads project .env files by
      // default). Real dance coverage uses AUTH_TEST_ISSUER (see
      // oauth-dance.test.ts), not these.
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
      AUTH_DISCORD_ID: "",
      AUTH_DISCORD_SECRET: "",
    },
    globalSetup: "./tests/global-setup.ts",
    // One SQLite file, suites that count/wipe rows: files must not interleave.
    fileParallelism: false,
  },
});
