import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * Accessibility check via axe-core. Fails on `serious` or `critical`
 * violations — `moderate` and `minor` are allowed (axe is conservative and
 * those are typically advisory).
 */
const STATIC_ROUTES = ["/brands", "/generations", "/usage", "/plugin"] as const;

for (const route of STATIC_ROUTES) {
  test(`a11y: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Devtools widgets are dev-only chrome and not part of the app under test.
      .exclude('button[aria-label*="TanStack" i]')
      .exclude('button[aria-label*="Tanstack" i]')
      .analyze();
    const blocking = result.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(blocking, `axe violations on ${route}:\n${JSON.stringify(blocking, null, 2)}`).toEqual([]);
  });
}

test("a11y: /brands/:brandId (Slack)", async ({ page, request }) => {
  const brands = (await request.get(`${API}/api/brands`).then((r) => r.json())) as Array<{
    id: string;
    name: string;
  }>;
  const slack = brands.find((b) => b.name === "Slack") ?? brands[0];
  if (!slack) throw new Error("needs a seeded brand");

  await page.goto(`/brands/${slack.id}`);
  await page.waitForLoadState("networkidle");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude('button[aria-label*="TanStack" i]')
    .exclude('button[aria-label*="Tanstack" i]')
    .analyze();
  const blocking = result.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(blocking, `axe violations on /brands/:brandId:\n${JSON.stringify(blocking, null, 2)}`).toEqual([]);
});
