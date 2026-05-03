import { test, expect } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:3001";

test("brands table — dropdown rename + delete", async ({ page, request }) => {
  // create a fresh brand via API so we don't depend on seed names
  const created = await request
    .post(`${API}/api/brands`, { data: { name: `RenameTarget-${Date.now()}` } })
    .then((r) => r.json());

  await page.goto("/brands");

  const row = page.getByRole("link", { name: new RegExp(`Open ${created.name}`) });
  await expect(row).toBeVisible();

  await page.getByRole("button", { name: `Actions for ${created.name}` }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const newName = `${created.name}-renamed`;
  await page.getByLabel("Brand name").fill(newName);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByRole("link", { name: new RegExp(`Open ${newName}`) }),
  ).toBeVisible();

  await page.getByRole("button", { name: `Actions for ${newName}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();

  await expect(
    page.getByRole("link", { name: new RegExp(`Open ${newName}`) }),
  ).toHaveCount(0);
});

/**
 * Golden-path smoke test:
 *   /brands -> click Slack -> ready profile visible
 *   -> remove a tone chip -> Save
 *   -> version count increments by 1
 *   -> click previous (now not-current) version -> "Set as current"
 *   -> is_current flips back; new version stays in the list (no row deletion)
 */
test("smoke: brand list -> detail -> edit -> save -> rollback", async ({ page, request }) => {
  // Pre-flight: figure out Slack's id and current version count from the API
  // so the assertion is deterministic regardless of seed/test history.
  const brands = await request.get(`${API}/api/brands`).then((r) => r.json());
  const slack = brands.find((b: { name: string }) => b.name === "Slack");
  expect(slack, "expected a seeded Slack brand").toBeTruthy();
  const beforeProfiles = await request
    .get(`${API}/api/brands/${slack.id}/profiles`)
    .then((r) => r.json());
  const beforeCount = beforeProfiles.length;
  const beforeCurrent = beforeProfiles.find((p: { isCurrent: boolean }) => p.isCurrent);
  expect(beforeCurrent, "Slack should have a current profile").toBeTruthy();

  // 1. Brands list
  await page.goto("/brands");
  await expect(page.getByRole("heading", { name: "Brands", level: 1 })).toBeVisible();

  // 2. Open Slack detail. The brand-name cell is a Link (a11y: no nested
  //    interactives in the row). The whole row also handles onClick as a
  //    UX nicety, but tests target the focusable link directly.
  await page.getByRole("link", { name: /Open Slack/ }).first().click();
  await expect(page.getByRole("heading", { name: "Slack", level: 1 })).toBeVisible();

  // 3. Ready profile editor visible (Voice tab default)
  await expect(page.getByRole("tab", { name: "Voice" })).toBeVisible();

  // 4. Capture the first tone chip's text and remove it
  const chips = page.locator(".chip");
  await expect(chips.first()).toBeVisible();
  const initialChipCount = await chips.count();
  expect(initialChipCount).toBeGreaterThan(0);
  const removed = (await chips.first().innerText()).trim().replace(/\s*×\s*$/, "").trim();
  await chips.first().getByRole("button", { name: new RegExp(`Remove ${removed}`, "i") }).click();
  await expect(chips).toHaveCount(initialChipCount - 1);

  // 5. Save -> wait for the Save button to leave its pending state
  await page.getByRole("button", { name: /^Save$/ }).click();
  // After save, list refetch -> Save becomes disabled (no diff)
  await expect(page.getByRole("button", { name: /^Save$/ })).toBeDisabled({ timeout: 15_000 });

  // 6. Version count increments by 1 (server-side truth)
  await expect
    .poll(
      async () => {
        const r = await request.get(`${API}/api/brands/${slack.id}/profiles`);
        const list = await r.json();
        return list.length;
      },
      { timeout: 10_000 },
    )
    .toBe(beforeCount + 1);

  const afterEdit = await request
    .get(`${API}/api/brands/${slack.id}/profiles`)
    .then((r) => r.json());
  const newCurrent = afterEdit.find((p: { isCurrent: boolean }) => p.isCurrent);
  expect(newCurrent.id).not.toBe(beforeCurrent.id);
  const previousId = beforeCurrent.id;

  // 7. UI shows the new version row in the timeline
  const newVersionLabel = `v${newCurrent.version}`;
  await expect(page.getByText(newVersionLabel, { exact: true })).toBeVisible({ timeout: 10_000 });

  // 8. Click "Set as current" on the previously-current version row.
  //    The VersionTimeline row that matches the previous version's number gets
  //    a "Set as current" button (since it is now non-current and ready).
  //    `.filter({ hasText: ... })` matches on substring across the whole row, so
  //    we filter by the `.v-num` cell to avoid colliding with PDF filenames
  //    (e.g. "slack-brand-v3.pdf" text inside other rows).
  const previousVersionLabel = `v${beforeCurrent.version}`;
  const previousRow = page
    .locator(".version-card li")
    .filter({ has: page.locator(".v-num", { hasText: new RegExp(`^${previousVersionLabel}$`) }) })
    .first();
  await expect(previousRow).toBeVisible();
  await previousRow.getByRole("button", { name: /Set as current/i }).click();

  // 9. After flip, the previous version is current again on the server.
  await expect
    .poll(
      async () => {
        const r = await request.get(`${API}/api/profiles/${previousId}`);
        const row = await r.json();
        return row.isCurrent;
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  // 10. UI reflects it: the "current" tag is on the previous version row,
  //     and no "Set as current" button on it anymore.
  await expect(previousRow).toContainText(/current/);
  await expect(previousRow.getByRole("button", { name: /Set as current/i })).toHaveCount(0);

  // Sanity: total version count stayed the same after rollback (no insert).
  const afterRollback = await request
    .get(`${API}/api/brands/${slack.id}/profiles`)
    .then((r) => r.json());
  expect(afterRollback.length).toBe(beforeCount + 1);
});
