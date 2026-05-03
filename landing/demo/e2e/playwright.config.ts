import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the Studio demo e2e workspace.
 *
 * The api (3001), web (5173) servers are reused if already running, otherwise
 * Playwright spawns them. The worker has no HTTP port; we don't manage it here.
 * Tests that need the worker (extraction, failure-retry) assume `pnpm dev` is
 * running on the side, or are skipped via `@live` / `FORCE_EXTRACT_FAIL` gates.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  // Tag-based filtering: by default exclude live tests so `pnpm test:e2e` is
  // hermetic. Run with `--grep @live` to opt-in.
  grepInvert: process.env.RUN_LIVE === "1" ? undefined : /@live/,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @studio/api dev",
      url: "http://localhost:3001/healthz",
      reuseExistingServer: true,
      timeout: 60_000,
      cwd: "..",
    },
    {
      command: "pnpm --filter @studio/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
      cwd: "..",
    },
  ],
});
