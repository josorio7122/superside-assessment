import { test, expect } from "@playwright/test";

const BRAND_ID = "11111111-1111-1111-1111-111111111111";

const brand = {
  id: BRAND_ID,
  orgId: "org-1",
  name: "Slack",
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  genCount30d: 0,
  lastActivityAt: null,
  profileStatus: "ready",
};

const baseProfile = {
  brand_name: "Slack",
  voice: { tone_descriptors: [], voice_principles: [], do: [], dont: [] },
  visual: {
    palette: [
      { name: "Aubergine", hex: "#4A154B", role: "primary" },
      { name: "Sunny", hex: "#ECB22E", role: "accent" },
    ],
    typography: { display: null, body: null, mono: null },
    logo_usage: [],
  },
  localization: { locales: [], notes: null },
  banned_terms: [],
};

const detailFor = (b: typeof brand, profile: unknown, sourcePdfFilename: string | null) => ({
  brand: {
    id: b.id,
    orgId: b.orgId,
    name: b.name,
    deletedAt: null,
    createdAt: b.createdAt,
  },
  currentProfile: {
    id: "p1",
    orgId: b.orgId,
    brandId: b.id,
    version: 1,
    status: "ready",
    profile,
    sourcePdfS3Key: sourcePdfFilename ? `profiles/${sourcePdfFilename}` : null,
    sourcePdfFilename,
    sourcePdfSizeBytes: 12345,
    ingestError: null,
    isCurrent: true,
    createdBy: null,
    createdAt: b.createdAt,
  },
  stats: { genCount30d: 0, lastActivityAt: null },
});

const onePxPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test.describe("/plugin", () => {
  test("brand selector + textarea + variant generation + apply", async ({ page }) => {
    await page.route("**/api/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ orgId: "org-1", userId: "u-1" }),
      }),
    );
    await page.route("**/api/brands", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([brand]),
      }),
    );
    await page.route(`**/api/brands/${BRAND_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detailFor(brand, baseProfile, "slack-brand-v3.pdf")),
      }),
    );
    await page.route("**/api/generations/image", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "gen-abc", status: "running" }),
      }),
    );
    await page.route("**/api/generations/gen-abc/events", (route) => {
      const body = [
        `event: open\ndata: {"generationId":"gen-abc"}\n\n`,
        `event: variant_ready\ndata: {"index":0,"s3Key":"gen-abc/0.png","size":"1024x1024"}\n\n`,
        `event: variant_ready\ndata: {"index":1,"s3Key":"gen-abc/1.png","size":"1024x1024"}\n\n`,
        `event: variant_ready\ndata: {"index":2,"s3Key":"gen-abc/2.png","size":"1024x1024"}\n\n`,
        `event: done\ndata: ${JSON.stringify({
          output: {
            variants: [
              { index: 0, s3Key: "gen-abc/0.png", size: "1024x1024" },
              { index: 1, s3Key: "gen-abc/1.png", size: "1024x1024" },
              { index: 2, s3Key: "gen-abc/2.png", size: "1024x1024" },
            ],
            model: "gpt-image-2",
            provider: "openai",
          },
        })}\n\n`,
      ].join("");
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body,
      });
    });
    await page.route("**/api/_storage/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: onePxPng }),
    );

    await page.goto("/plugin");

    await expect(page.getByRole("button", { name: /Slack/ })).toBeVisible();

    const ta = page.getByLabel("Prompt");
    await expect(ta).toBeVisible();
    await ta.fill("a serene office");
    await expect(page.getByText("15 / 200")).toBeVisible();

    await page.getByRole("button", { name: /Regenerate/ }).click();

    const variants = page.locator(".variant");
    await expect(variants).toHaveCount(3);
    await expect(variants.nth(0).locator("img")).toBeVisible();
    await expect(variants.nth(1).locator("img")).toBeVisible();
    await expect(variants.nth(2).locator("img")).toBeVisible();

    await variants.nth(1).click();
    await expect(variants.nth(1)).toHaveAttribute("data-applied", "");

    const heroImg = page.locator(".plugin-canvas .ad-image img");
    await expect(heroImg).toHaveAttribute("src", /api\/_storage/);
  });

  test("Regenerate disabled when prompt empty", async ({ page }) => {
    await page.route("**/api/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ orgId: "org-1", userId: "u-1" }),
      }),
    );
    await page.route("**/api/brands", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([brand]),
      }),
    );
    await page.route(`**/api/brands/${BRAND_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detailFor(brand, baseProfile, null)),
      }),
    );

    await page.goto("/plugin");
    const ta = page.getByLabel("Prompt");
    await ta.fill("");
    await expect(page.getByRole("button", { name: /Regenerate/ })).toBeDisabled();
  });
});
