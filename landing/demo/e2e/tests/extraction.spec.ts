import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrandProfileSchema } from "@studio/schemas";

const __dir = dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * Live extraction smoke: hits OpenRouter, costs real tokens. Skipped in the
 * default `pnpm test:e2e` run via the `@live` tag (see playwright.config.ts
 * `grepInvert`). To run: `RUN_LIVE=1 pnpm test:e2e`.
 *
 * The seed pre-extracts Slack and Heineken once and caches the JSON in
 * `infra/seed-extractions/`, so the per-developer cost is zero on warm
 * machines. This test deliberately creates a *fresh* brand each run so it
 * exercises the live worker path end-to-end.
 */
test("@live extraction: upload Slack PDF -> ready profile -> Zod-valid", async ({
  request,
}) => {
  test.setTimeout(200_000);

  const pdfPath = join(__dir, "..", "..", "infra", "seed-pdfs", "slack-2020.pdf");
  const pdf = await readFile(pdfPath);

  // Fresh brand
  const createBrand = await request.post(`${API}/api/brands`, {
    data: { name: `LiveExtraction-${Date.now()}` },
  });
  expect(createBrand.ok(), `POST /api/brands -> ${createBrand.status()}`).toBeTruthy();
  const brand = await createBrand.json();

  // Upload PDF -> enqueues extraction job
  const upload = await request.post(`${API}/api/brands/${brand.id}/profiles`, {
    multipart: {
      file: { name: "slack-2020.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  expect(
    upload.ok(),
    `POST /api/brands/:id/profiles -> ${upload.status()}: ${await upload.text()}`,
  ).toBeTruthy();
  const created = await upload.json();
  expect(created.status).toBe("processing");

  // Poll until ready (or fail loudly)
  const start = Date.now();
  let row = created;
  while (Date.now() - start < 180_000 && row.status !== "ready") {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await request.get(`${API}/api/profiles/${created.id}`);
    expect(r.ok()).toBeTruthy();
    row = await r.json();
    if (row.status === "failed") {
      throw new Error(`extraction failed: ${row.ingestError ?? "unknown"}`);
    }
  }
  expect(row.status, "extraction did not reach ready within 180s").toBe("ready");

  // Schema-valid + meaningful contents
  const parsed = BrandProfileSchema.parse(row.profile);
  expect(parsed.brand_name.length).toBeGreaterThan(0);
  expect(parsed.voice.tone_descriptors.length).toBeGreaterThan(0);
  expect(parsed.visual.palette.length).toBeGreaterThanOrEqual(3);
});
