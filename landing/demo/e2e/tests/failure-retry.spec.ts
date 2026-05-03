import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dir = dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * Fail-once-then-succeed integration test.
 *
 * Pre-condition: the worker must be started with FORCE_EXTRACT_FAIL=1 so the
 * first attempt for each profile id throws synthetically. The handler counts
 * by profileId and only fails the first attempt, so the retry path runs the
 * real extraction. See apps/worker/src/extract-profile-handler.ts.
 *
 * Skipped automatically unless FORCE_EXTRACT_FAIL=1 is in the test process
 * env (which the user must set when starting the worker, and pass through to
 * Playwright). To run:
 *
 *   # Terminal A
 *   cd landing/demo && FORCE_EXTRACT_FAIL=1 pnpm --filter @studio/worker dev
 *   # Terminal B
 *   cd landing/demo && FORCE_EXTRACT_FAIL=1 RUN_LIVE=1 \
 *     pnpm --filter @studio/e2e test failure-retry
 */
test("failure-retry: forced failure -> retry -> ready", async ({ request }) => {
  test.skip(
    process.env.FORCE_EXTRACT_FAIL !== "1",
    "needs worker started with FORCE_EXTRACT_FAIL=1 (see test docstring)",
  );
  test.setTimeout(240_000);

  const pdfPath = join(__dir, "..", "..", "infra", "seed-pdfs", "heineken.pdf");
  const pdf = await readFile(pdfPath);

  // Fresh brand
  const createBrand = await request.post(`${API}/api/brands`, {
    data: { name: `FailRetry-${Date.now()}` },
  });
  expect(createBrand.ok()).toBeTruthy();
  const brand = await createBrand.json();

  // Upload Heineken PDF (worker fails the first time, then we retry)
  const upload = await request.post(`${API}/api/brands/${brand.id}/profiles`, {
    multipart: {
      file: { name: "heineken.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  expect(upload.ok()).toBeTruthy();
  const created = await upload.json();

  // Poll for failed
  let row = created;
  const failStart = Date.now();
  while (Date.now() - failStart < 60_000 && row.status !== "failed") {
    await new Promise((r) => setTimeout(r, 1500));
    row = await request.get(`${API}/api/profiles/${created.id}`).then((r) => r.json());
  }
  expect(row.status, "expected first attempt to fail").toBe("failed");
  expect(row.ingestError, "failed row should carry an error message").toBeTruthy();

  // Retry
  const retry = await request.post(`${API}/api/profiles/${created.id}/retry`);
  expect(retry.ok(), `POST /retry -> ${retry.status()}`).toBeTruthy();

  // Poll for ready
  const okStart = Date.now();
  while (Date.now() - okStart < 180_000 && row.status !== "ready") {
    await new Promise((r) => setTimeout(r, 2000));
    row = await request.get(`${API}/api/profiles/${created.id}`).then((r) => r.json());
    if (row.status === "failed") {
      throw new Error(`retry failed: ${row.ingestError}`);
    }
  }
  expect(row.status, "retry should produce a ready profile").toBe("ready");
});
