import { test, expect } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * Visual regression suite.
 *
 * Snapshots are stored under `tests/visual.spec.ts-snapshots/`. The threshold
 * is set in `playwright.config.ts` (maxDiffPixelRatio: 0.02). To regenerate
 * baselines after an intentional change:
 *
 *   pnpm --filter @studio/e2e test visual -- --update-snapshots
 *
 * The TanStack devtool floating widgets and the dev-server ribbon are masked
 * because they're dev-only chrome and would create flake.
 */
const PAGES: Array<{ id: string; build: () => Promise<string> }> = [
  { id: "brands", build: async () => "/brands" },
  {
    id: "brand-detail",
    build: async () => {
      const r = await fetch(`${API}/api/brands`);
      const list = (await r.json()) as Array<{ id: string; name: string }>;
      const slack = list.find((b) => b.name === "Slack") ?? list[0];
      if (!slack) throw new Error("no brands seeded — run pnpm db:seed");
      return `/brands/${slack.id}`;
    },
  },
  { id: "generations", build: async () => "/generations" },
  { id: "usage", build: async () => "/usage" },
  { id: "plugin", build: async () => "/plugin" },
];

for (const p of PAGES) {
  test(`visual: ${p.id}`, async ({ page }) => {
    const url = await p.build();
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    // Skeletons, charts, and animations need a beat to settle.
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot(`${p.id}.png`, {
      fullPage: true,
      mask: [
        // TanStack devtools floating widgets render via portals at the body
        // root; mask anything matching their fixed-position triggers.
        page.locator('button[aria-label*="TanStack" i]'),
        page.locator('button[aria-label*="Tanstack query" i]'),
        page.locator('button[aria-label*="Open TanStack Router Devtools" i]'),
      ],
    });
  });
}
