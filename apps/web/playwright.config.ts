import { defineConfig, devices } from "@playwright/test";

// E2E for the player app. Runs against `next dev` (Playwright boots it via
// webServer). The story content is the bundled demo; tests drive the real play
// loop, so timeouts are generous — the chat drips messages on a timer.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  // Cover both engines the app actually ships on (Android WebView = Chromium/
  // Blink, iOS WKWebView = WebKit), at desktop and mobile form factors. These
  // are the desktop builds of each engine — a strong proxy for on-device
  // behavior, not a substitute for a real-device check of the Capacitor shell.
  // Run a subset with e.g. `pnpm e2e --project="Mobile Safari"`.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }, // fast local default
    { name: "webkit", use: { ...devices["Desktop Safari"] } }, // iOS engine (WebKit)
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } }, // Android target
    { name: "Mobile Safari", use: { ...devices["iPhone 13"] } }, // iOS target
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
