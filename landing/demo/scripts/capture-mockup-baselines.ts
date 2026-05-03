#!/usr/bin/env tsx
/**
 * Capture the landing-page Astro mockup panels into PNG baselines for human
 * comparison against the React port.
 *
 * Boots the landing dev server (`pnpm dev` from `../../landing/`), waits for
 * the dev port to come up, navigates to each `#solution-<id>` hash, and
 * screenshots the matching `[data-panel="<id>"][data-active]` element into
 * `e2e/baselines/<id>.png`.
 *
 * NOT used by Playwright assertions — the React port lives in a separate DOM
 * tree, so pixel parity is approximate. These images are reference only.
 *
 * Run: `pnpm --filter studio-demo exec tsx scripts/capture-mockup-baselines.ts`
 * or  `node --import tsx scripts/capture-mockup-baselines.ts`
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dir = dirname(fileURLToPath(import.meta.url));
const DEMO_ROOT = resolve(__dir, "..");
const LANDING_ROOT = resolve(DEMO_ROOT, "..");
const OUT_DIR = join(DEMO_ROOT, "e2e", "baselines");
const BASE_PATH = "/superside-assessment";

const TAB_IDS = ["brands", "guideline", "generations", "usage", "plugin"] as const;

interface DevServer {
  url: string;
  child: ChildProcess;
  spawned: boolean;
}

async function checkExisting(): Promise<string | null> {
  for (const port of [4321, 4322, 4323]) {
    try {
      const r = await fetch(`http://localhost:${port}${BASE_PATH}/`, {
        signal: AbortSignal.timeout(1000),
      });
      if (r.ok) return `http://localhost:${port}`;
    } catch {
      // not running on this port
    }
  }
  return null;
}

async function startLanding(): Promise<DevServer> {
  const existing = await checkExisting();
  if (existing) {
    console.log(`[capture] reusing landing dev server at ${existing}`);
    return { url: existing, child: null as unknown as ChildProcess, spawned: false };
  }

  console.log(`[capture] spawning landing dev server (cwd=${LANDING_ROOT})`);
  const child = spawn("pnpm", ["dev"], {
    cwd: LANDING_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const url = await new Promise<string>((resolveUrl, rejectUrl) => {
    const timer = setTimeout(
      () => rejectUrl(new Error("landing dev did not become ready in 60s")),
      60_000,
    );
    const handle = (chunk: Buffer) => {
      const s = chunk.toString();
      // Astro prints a "Local: http://localhost:4321/..." line on ready
      const m = s.match(/Local:?\s*(http:\/\/localhost:\d+)/);
      if (m && m[1]) {
        clearTimeout(timer);
        resolveUrl(m[1]);
      }
    };
    child.stdout?.on("data", handle);
    child.stderr?.on("data", handle);
    child.on("exit", (code) => {
      clearTimeout(timer);
      rejectUrl(new Error(`landing dev exited with code ${code} before ready`));
    });
  });

  return { url, child, spawned: true };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const dev = await startLanding();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    const base = `${dev.url}${BASE_PATH}/`;

    for (const id of TAB_IDS) {
      await page.goto(`${base}#solution-${id}`);
      await page.waitForLoadState("networkidle");
      // Click the matching tab to ensure data-active is set, since hash-only
      // navigation may not toggle the panel without a user event.
      await page.locator(`[data-tab="${id}"]`).click().catch(() => {
        /* tab might already be active */
      });
      const panel = page.locator(`[data-panel="${id}"][data-active]`);
      await panel.waitFor({ state: "visible", timeout: 5000 });
      const buf = await panel.screenshot({ type: "png" });
      await writeFile(join(OUT_DIR, `${id}.png`), buf);
      console.log(`[capture] wrote ${id}.png`);
    }
  } finally {
    await browser.close();
    if (dev.spawned && dev.child) dev.child.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
