# Plugin Interactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the demo `/plugin` route in `landing/demo/apps/web` functional end-to-end for the Image tab — editable prompt, working brand selector, real `gpt-image-2` generation via OpenAI direct, BullMQ + SSE per-variant streaming, persisted to `generation` + `usage_event`.

**Architecture:** Mirror the existing `extract-profile-handler` pattern. POST creates a `generation` row + enqueues a BullMQ job. Worker fires 3 parallel `experimental_generateImage` calls, uploads each PNG to S3, publishes a per-variant Redis pubsub event. API SSE endpoint relays events to the web client. Brand grounding (palette + logo guidance) appended server-side.

**Tech Stack:** pnpm workspace · TypeScript · Hono · BullMQ · Drizzle · React 19 · Tanstack Router/Query · Redis pub/sub · LocalStack S3 · `ai` SDK + `@ai-sdk/openai`.

**Spec:** `docs/superpowers/specs/2026-05-03-plugin-interactivity-design.md`

**Working dir for all paths:** `/Users/josorio/Code/superside/landing/demo` (paths below are relative to it unless absolute).

**Conventions:**
- Commit after every task with `git -c commit.gpgsign=false commit ...` (no GPG on this machine).
- Run `pnpm -w typecheck` before each commit. Fix any type errors before proceeding.
- All new files use `.js` import extensions for cross-package imports (existing convention — see existing files).

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `.env`, `.env.example` | Modify | Add `OPENAI_API_KEY` |
| `packages/ai/package.json` | Modify | Add `@ai-sdk/openai` |
| `packages/ai/src/pricing.ts` | Modify | Per-image pricing alongside per-token |
| `packages/ai/src/generate-image.ts` | Create | `generateImageVariant(prompt, opts)` |
| `packages/ai/src/build-grounded-prompt.ts` | Create | `buildGroundedPrompt(userPrompt, profile)` |
| `packages/ai/src/index.ts` | Modify | Re-export new modules |
| `packages/ai/src/generate-image.test.ts` | Create | Unit test for pricing + return shape |
| `packages/ai/src/build-grounded-prompt.test.ts` | Create | Snapshot test for grounded prompt |
| `packages/schemas/src/generation.ts` | Modify | Add `CreateImageGenerationSchema` |
| `apps/api/src/infra/redis.ts` | Modify | Export `GENERATION_EVENTS_CHANNEL` |
| `apps/api/src/infra/sse.ts` | Modify | Add `streamGenerationEvents` |
| `apps/api/src/infra/queue.ts` | Modify | Add `generateImageQueue` + `GenerateImageJob` type |
| `apps/api/src/routes/generation/repository.ts` | Modify | Add `create`, `markDone`, `markFailed` |
| `apps/api/src/routes/generation/service.ts` | Create | `createImage` orchestration |
| `apps/api/src/routes/generation/router.ts` | Modify | `POST /image` + `GET /:id/events` |
| `apps/api/src/routes/generation/router.test.ts` | Create | POST validation tests |
| `apps/worker/src/infra.ts` | Modify | Add generic `putBytes` (rename of `putPdfBytes`) |
| `apps/worker/src/generate-image-handler.ts` | Create | BullMQ handler for `generate-image` queue |
| `apps/worker/src/index.ts` | Modify | Register `generate-image` worker |
| `apps/web/src/lib/api.ts` | Modify | `generations.createImage`, `generations.eventsUrl` |
| `apps/web/src/lib/sse.ts` | Modify | Add `useGenerationEvents` hook |
| `apps/web/src/routes/plugin.tsx` | Rewrite | Full interactive component |
| `apps/web/src/features/plugin/plugin.css` | Modify | Layout + variants + skeleton + textarea + error styles |
| `e2e/tests/plugin.spec.ts` | Create | Fixture-driven Playwright e2e |
| `scripts/smoke-plugin.sh` | Create | curl integration smoke |
| `package.json` | Modify | Add `smoke:plugin` script |
| `README.md` | Modify | Document smoke + new env var |

---

## Task 1: Env vars + OpenAI dep

**Files:**
- Modify: `.env`
- Modify: `.env.example`
- Modify: `packages/ai/package.json`

- [ ] **Step 1: Add OPENAI_API_KEY to `.env.example`**

After existing `OPENROUTER_API_KEY=sk-or-replace-me` line, add:
```
OPENAI_API_KEY=sk-proj-replace-me
```

(Note: `.env` already has the live key from a prior step in this session — verify with `grep OPENAI_API_KEY .env`. If missing, copy from your environment: `OPENAI_API_KEY=$OPENAI_API_KEY`.)

- [ ] **Step 2: Add `@ai-sdk/openai` to packages/ai**

Modify `packages/ai/package.json` dependencies. After the existing `"ai": "^6.0.174",` line:

```json
    "@ai-sdk/openai": "^2.0.0",
    "ai": "^6.0.174",
```

- [ ] **Step 3: Install**

```bash
cd /Users/josorio/Code/superside/landing/demo && pnpm install
```
Expected: lockfile updates, `@ai-sdk/openai` added. No errors.

- [ ] **Step 4: Verify**

```bash
ls /Users/josorio/Code/superside/landing/demo/node_modules/.pnpm | grep ai-sdk
```
Expected: directory like `@ai-sdk+openai@2.x.y_…`.

- [ ] **Step 5: Commit**

```bash
cd /Users/josorio/Code/superside/landing/demo
git add .env.example packages/ai/package.json pnpm-lock.yaml
git -c commit.gpgsign=false commit -m "deps: add @ai-sdk/openai + OPENAI_API_KEY env"
```

---

## Task 2: Per-image pricing in `packages/ai/src/pricing.ts`

**Files:**
- Modify: `packages/ai/src/pricing.ts`
- Modify: `packages/ai/src/extract-brand-profile.ts` (call-site adjustment)

`gpt-image-2` charges per generated image, not per token. Current pricing semantics treat everything as per-1k-tokens, which underprices image gen by 1000×.

- [ ] **Step 1: Replace pricing.ts with discriminated-union pricing**

Replace entire content of `packages/ai/src/pricing.ts`:

```ts
type Pricing =
  | { kind: "tokens"; inputPer1k: number; outputPer1k: number }
  | { kind: "image"; perImage: number };

const PRICES: Record<string, Pricing> = {
  "openai/gpt-5.5": { kind: "tokens", inputPer1k: 0.00125, outputPer1k: 0.01 },
  "openai/gpt-image-2": { kind: "image", perImage: 0.04 },
};

export function priceUsage(input: { model: string; inputTokens: number; outputTokens: number }): number {
  const p = PRICES[input.model];
  if (!p || p.kind !== "tokens") return 0;
  return (input.inputTokens / 1000) * p.inputPer1k + (input.outputTokens / 1000) * p.outputPer1k;
}

export function priceImageUsage(input: { model: string; imageCount: number }): number {
  const p = PRICES[input.model];
  if (!p || p.kind !== "image") return 0;
  return p.perImage * input.imageCount;
}
```

- [ ] **Step 2: Verify extract-brand-profile.ts still compiles**

Run: `pnpm --filter @studio/ai typecheck`
Expected: PASS. (`extract-brand-profile.ts` calls `priceUsage({model, inputTokens, outputTokens})` — still valid for the `tokens` kind.)

- [ ] **Step 3: Commit**

```bash
cd /Users/josorio/Code/superside/landing/demo
git add packages/ai/src/pricing.ts
git -c commit.gpgsign=false commit -m "feat(ai): per-image pricing alongside per-token"
```

---

## Task 3: `buildGroundedPrompt` helper + test

**Files:**
- Create: `packages/ai/src/build-grounded-prompt.ts`
- Create: `packages/ai/src/build-grounded-prompt.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/ai/src/build-grounded-prompt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { emptyBrandProfile, type BrandProfile } from "@studio/schemas";
import { buildGroundedPrompt } from "./build-grounded-prompt.js";

const baseProfile: BrandProfile = {
  ...emptyBrandProfile("Slack"),
  visual: {
    palette: [
      { name: "Aubergine", hex: "#4A154B", role: "primary" },
      { name: "Sunny Yellow", hex: "#ECB22E", role: "accent" },
    ],
    typography: { display: null, body: null, mono: null },
    logo_usage: ["Always 16px clear space around logo."],
  },
};

describe("buildGroundedPrompt", () => {
  it("includes user prompt verbatim at the top", () => {
    const out = buildGroundedPrompt("modern team office", baseProfile);
    expect(out.startsWith("modern team office\n")).toBe(true);
  });

  it("appends brand name", () => {
    const out = buildGroundedPrompt("x", baseProfile);
    expect(out).toContain("Brand: Slack.");
  });

  it("appends palette colors when present", () => {
    const out = buildGroundedPrompt("x", baseProfile);
    expect(out).toContain("Aubergine (#4A154B)");
    expect(out).toContain("Sunny Yellow (#ECB22E)");
  });

  it("appends logo guideline when present", () => {
    const out = buildGroundedPrompt("x", baseProfile);
    expect(out).toContain("Always 16px clear space around logo.");
  });

  it("omits palette line when palette empty", () => {
    const profile = emptyBrandProfile("Empty");
    const out = buildGroundedPrompt("x", profile);
    expect(out).not.toContain("Visual must align");
  });

  it("omits logo line when logo_usage empty", () => {
    const profile = emptyBrandProfile("NoLogo");
    const out = buildGroundedPrompt("x", profile);
    expect(out).not.toContain("Logo guideline");
  });

  it("includes style suffix", () => {
    const out = buildGroundedPrompt("x", baseProfile);
    expect(out).toContain("Style: photographic, marketing-grade, no on-image text.");
  });
});
```

- [ ] **Step 2: Run test, verify fails**

```bash
cd /Users/josorio/Code/superside/landing/demo
pnpm --filter @studio/ai test build-grounded-prompt 2>&1 | head -30
```
Expected: FAIL — `Cannot find module './build-grounded-prompt.js'`. (If vitest not configured, see Step 2b.)

- [ ] **Step 2b: If vitest not present in @studio/ai, add it**

Check `packages/ai/package.json` for `vitest`. If absent, add to devDependencies + a `test` script:
```json
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    ...,
    "vitest": "^2.1.0"
  }
```
Run `pnpm install` then re-run the failing test.

- [ ] **Step 3: Implement `buildGroundedPrompt`**

Create `packages/ai/src/build-grounded-prompt.ts`:

```ts
import type { BrandProfile } from "@studio/schemas";

export function buildGroundedPrompt(userPrompt: string, profile: BrandProfile): string {
  const colors = profile.visual.palette
    .slice(0, 5)
    .map((p) => `${p.name} (${p.hex})`)
    .join(", ");
  const logoCue = profile.visual.logo_usage[0];
  const colorLine = colors ? `\nVisual must align with brand palette: ${colors}.` : "";
  const logoLine = logoCue ? `\nLogo guideline: ${logoCue}.` : "";
  return `${userPrompt}

Brand: ${profile.brand_name}.${colorLine}${logoLine}
Style: photographic, marketing-grade, no on-image text.`;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm --filter @studio/ai test build-grounded-prompt
```
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/build-grounded-prompt.ts packages/ai/src/build-grounded-prompt.test.ts packages/ai/package.json
git -c commit.gpgsign=false commit -m "feat(ai): buildGroundedPrompt + tests"
```

---

## Task 4: `generateImageVariant` + test

**Files:**
- Create: `packages/ai/src/generate-image.ts`
- Create: `packages/ai/src/generate-image.test.ts`
- Modify: `packages/ai/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/ai/src/generate-image.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  experimental_generateImage: vi.fn(async () => ({
    image: { uint8Array: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
  })),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: { image: (m: string) => ({ provider: "openai", modelId: m }) },
}));

import { experimental_generateImage } from "ai";
import { generateImageVariant } from "./generate-image.js";

describe("generateImageVariant", () => {
  it("returns image bytes + usage with correct cost", async () => {
    const r = await generateImageVariant("a cat", { seed: 42 });
    expect(r.image).toBeInstanceOf(Uint8Array);
    expect(r.image.length).toBeGreaterThan(0);
    expect(r.usage.provider).toBe("openai");
    expect(r.usage.model).toBe("openai/gpt-image-2");
    expect(r.usage.inputTokens).toBe(0);
    expect(r.usage.outputTokens).toBe(1);
    expect(r.usage.costUsd).toBe(0.04); // per-image pricing
    expect(r.usage.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("passes seed + size to model call", async () => {
    await generateImageVariant("a dog", { seed: 7 });
    const calls = (experimental_generateImage as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const last = calls[calls.length - 1][0] as { prompt: string; size: string; seed: number; n: number };
    expect(last.prompt).toBe("a dog");
    expect(last.size).toBe("1024x1024");
    expect(last.seed).toBe(7);
    expect(last.n).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, verify fails**

```bash
pnpm --filter @studio/ai test generate-image 2>&1 | head -30
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `generateImageVariant`**

Create `packages/ai/src/generate-image.ts`:

```ts
import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { experimental_generateImage as generateImage } from "ai";
import { priceImageUsage } from "./pricing.js";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required for image generation");
}

export type ImageVariantUsage = {
  model: "openai/gpt-image-2";
  provider: "openai";
  inputTokens: 0;
  outputTokens: 1;
  costUsd: number;
  latencyMs: number;
};

export async function generateImageVariant(
  prompt: string,
  opts: { seed: number },
): Promise<{ image: Uint8Array; usage: ImageVariantUsage }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const { image } = await generateImage({
      model: openai.image("gpt-image-2"),
      prompt,
      size: "1024x1024",
      seed: opts.seed,
      n: 1,
      abortSignal: ctrl.signal,
    });
    return {
      image: image.uint8Array,
      usage: {
        model: "openai/gpt-image-2",
        provider: "openai",
        inputTokens: 0,
        outputTokens: 1,
        costUsd: priceImageUsage({ model: "openai/gpt-image-2", imageCount: 1 }),
        latencyMs: Date.now() - t0,
      },
    };
  } finally {
    clearTimeout(to);
  }
}
```

- [ ] **Step 4: Re-export from index**

Modify `packages/ai/src/index.ts` — add lines after existing exports:

```ts
export * from "./generate-image.js";
export * from "./build-grounded-prompt.js";
```

- [ ] **Step 5: Run tests, verify pass**

```bash
pnpm --filter @studio/ai test
```
Expected: PASS (all generate-image tests + grounded-prompt tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/generate-image.ts packages/ai/src/generate-image.test.ts packages/ai/src/index.ts
git -c commit.gpgsign=false commit -m "feat(ai): generateImageVariant via @ai-sdk/openai"
```

---

## Task 5: `CreateImageGenerationSchema` in `@studio/schemas`

**Files:**
- Modify: `packages/schemas/src/generation.ts`

- [ ] **Step 1: Append schema**

Append to `packages/schemas/src/generation.ts`:

```ts
export const CreateImageGenerationSchema = z.object({
  prompt: z.string().trim().min(1, "prompt required").max(200, "prompt must be ≤200 chars"),
  brandId: z.string().uuid(),
  layerName: z.string().max(120).optional().default("untitled"),
});
export type CreateImageGenerationBody = z.infer<typeof CreateImageGenerationSchema>;
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @studio/schemas typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/schemas/src/generation.ts
git -c commit.gpgsign=false commit -m "feat(schemas): CreateImageGenerationSchema"
```

---

## Task 6: API infra — Redis channel, queue, SSE stream

**Files:**
- Modify: `apps/api/src/infra/redis.ts`
- Modify: `apps/api/src/infra/queue.ts`
- Modify: `apps/api/src/infra/sse.ts`

- [ ] **Step 1: Add Redis channel constant**

Modify `apps/api/src/infra/redis.ts`. Append after `PROFILE_EVENTS_CHANNEL`:

```ts
export const GENERATION_EVENTS_CHANNEL = "generation:events";
```

- [ ] **Step 2: Add queue + job type**

Modify `apps/api/src/infra/queue.ts`. After existing `extractProfileQueue` block, add:

```ts
export type GenerateImageJob = {
  generationId: string;
  orgId: string;
  brandId: string;
  userId: string;
  groundedPrompt: string;
};

export const generateImageQueue = new Queue<GenerateImageJob>("generate-image", {
  connection: redisQueue,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
```

- [ ] **Step 3: Add SSE stream for generations**

Modify `apps/api/src/infra/sse.ts`. After the existing `streamProfileEvents` function, add:

```ts
import { GENERATION_EVENTS_CHANNEL } from "./redis.js";

export type GenerationEvent =
  | { generationId: string; event: "variant_ready"; index: number; s3Key: string; size: string }
  | { generationId: string; event: "done"; output: unknown }
  | { generationId: string; event: "failed"; error: string };

let genSubscribed = false;
const genSubscribers = new Map<string, Set<(e: GenerationEvent) => void>>();

async function ensureGenSubscribed() {
  if (genSubscribed) return;
  genSubscribed = true;
  await redisSub.subscribe(GENERATION_EVENTS_CHANNEL);
  redisSub.on("message", (channel, message) => {
    if (channel !== GENERATION_EVENTS_CHANNEL) return;
    try {
      const parsed = JSON.parse(message) as GenerationEvent;
      const set = genSubscribers.get(parsed.generationId);
      if (set) for (const cb of set) cb(parsed);
    } catch {}
  });
}

export async function streamGenerationEvents(c: Context, generationId: string) {
  await ensureGenSubscribed();

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("open", { generationId });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      const cb = (e: GenerationEvent) => send(e.event, e);
      const set = genSubscribers.get(generationId) ?? new Set();
      set.add(cb);
      genSubscribers.set(generationId, set);

      const abort = () => {
        clearInterval(heartbeat);
        const s = genSubscribers.get(generationId);
        if (s) {
          s.delete(cb);
          if (s.size === 0) genSubscribers.delete(generationId);
        }
        try {
          controller.close();
        } catch {}
      };
      c.req.raw.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

If the existing file already imports `redisSub` and `PROFILE_EVENTS_CHANNEL`, leave those imports — only add the `GENERATION_EVENTS_CHANNEL` import line.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @studio/api typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/infra/
git -c commit.gpgsign=false commit -m "feat(api): generation pubsub channel + queue + SSE stream"
```

---

## Task 7: Generation repo extension + service

**Files:**
- Modify: `apps/api/src/routes/generation/repository.ts`
- Create: `apps/api/src/routes/generation/service.ts`
- Modify: `apps/api/src/routes/brand-profile/repository.ts` (add `currentForBrand`-style read if missing)

- [ ] **Step 1: Verify brand-profile repo has a current-fetch method**

```bash
grep -n "isCurrent" /Users/josorio/Code/superside/landing/demo/apps/api/src/routes/brand-profile/repository.ts
```
Expected: at least one match using `eq(...isCurrent, true)`. If no method exposes "fetch current profile by brand", add one in step 2.

- [ ] **Step 2: Add `currentForBrand` to brand-profile repo if absent**

If grep above showed no method named `current` or similar, append to `apps/api/src/routes/brand-profile/repository.ts` inside the exported repo object:

```ts
async currentForBrand(orgId: string, brandId: string) {
  const [row] = await db
    .select()
    .from(schema.brandProfiles)
    .where(
      and(
        eq(schema.brandProfiles.orgId, orgId),
        eq(schema.brandProfiles.brandId, brandId),
        eq(schema.brandProfiles.isCurrent, true),
      ),
    );
  return row ? ok(row) : err(new RepoError("not_found", `no current profile for brand ${brandId}`));
},
```

(Imports already in the file: `db, schema, ok, err, RepoError, and, eq`. If any is missing, add to the existing import line.)

- [ ] **Step 3: Extend generation repo**

Modify `apps/api/src/routes/generation/repository.ts`. Add to the exported `genRepo` object after `getById`:

```ts
async create(input: {
  orgId: string;
  brandId: string;
  userId: string;
  inputJson: unknown;
}) {
  const [row] = await db
    .insert(schema.generations)
    .values({
      orgId: input.orgId,
      brandId: input.brandId,
      userId: input.userId,
      type: "image",
      status: "running",
      input: input.inputJson,
      output: null,
      figmaFileKey: null,
      figmaNodeId: null,
      startedAt: new Date(),
    })
    .returning();
  return ok(row);
},
```

- [ ] **Step 4: Create generation service**

Create `apps/api/src/routes/generation/service.ts`:

```ts
import { buildGroundedPrompt } from "@studio/ai";
import { err, ok, RepoError } from "@studio/db";
import type { CreateImageGenerationBody } from "@studio/schemas";
import { brandProfileRepo } from "../brand-profile/repository.js";
import { brandRepo } from "../brand/repository.js";
import { generateImageQueue } from "../../infra/queue.js";
import { genRepo } from "./repository.js";

export const generationService = {
  async createImage(input: {
    orgId: string;
    userId: string;
    body: CreateImageGenerationBody;
  }) {
    const { orgId, userId } = input;
    const { prompt, brandId, layerName } = input.body;

    const brand = await brandRepo.getById(orgId, brandId);
    if (!brand.ok) return brand;

    const profile = await brandProfileRepo.currentForBrand(orgId, brandId);
    if (!profile.ok) {
      return err(new RepoError("conflict", "brand has no ready profile"));
    }
    if (profile.value.status !== "ready" || !profile.value.profile) {
      return err(new RepoError("conflict", "brand profile not ready"));
    }

    const groundedPrompt = buildGroundedPrompt(prompt, profile.value.profile);

    const created = await genRepo.create({
      orgId,
      brandId,
      userId,
      inputJson: {
        prompt,
        groundedPrompt,
        brandId,
        layerName,
        layerSize: "1024x1024",
        profileVersion: profile.value.version,
      },
    });
    if (!created.ok) return created;

    await generateImageQueue.add(
      "generate-image",
      {
        generationId: created.value.id,
        orgId,
        brandId,
        userId,
        groundedPrompt,
      },
      { jobId: created.value.id },
    );
    return ok({ id: created.value.id, status: "running" as const });
  },
};
```

If `brandRepo.getById` doesn't exist with that exact signature, check `apps/api/src/routes/brand/repository.ts` and adjust the call. The pattern in this codebase is `(orgId, id) => Result`.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @studio/api typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/generation/repository.ts apps/api/src/routes/generation/service.ts apps/api/src/routes/brand-profile/repository.ts
git -c commit.gpgsign=false commit -m "feat(api): generation create repo + image service with grounding"
```

---

## Task 8: Wire `POST /image` + `GET /:id/events` in router

**Files:**
- Modify: `apps/api/src/routes/generation/router.ts`

- [ ] **Step 1: Replace router contents**

Replace `apps/api/src/routes/generation/router.ts`:

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { CreateImageGenerationSchema, GenerationsQuerySchema } from "@studio/schemas";
import { streamGenerationEvents } from "../../infra/sse.js";
import { send, sendCreated } from "../../lib/result-to-http.js";
import { genRepo } from "./repository.js";
import { generationService } from "./service.js";

export const generationRouter = new Hono()
  .get("/", zValidator("query", GenerationsQuerySchema), async (c) => {
    const q = c.req.valid("query");
    return send(c, await genRepo.list(c.get("orgId"), q));
  })
  .get("/:id", async (c) => send(c, await genRepo.getById(c.get("orgId"), c.req.param("id"))))
  .get("/:id/events", (c) => streamGenerationEvents(c, c.req.param("id")))
  .post("/image", zValidator("json", CreateImageGenerationSchema), async (c) =>
    sendCreated(
      c,
      await generationService.createImage({
        orgId: c.get("orgId"),
        userId: c.get("userId"),
        body: c.req.valid("json"),
      }),
    ),
  );
```

If `sendCreated` doesn't exist in `lib/result-to-http.js`, use `send` (response will be 200 instead of 201; acceptable for demo).

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @studio/api typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/generation/router.ts
git -c commit.gpgsign=false commit -m "feat(api): POST /generations/image + GET /:id/events"
```

---

## Task 9: Worker — generic byte put + image handler

**Files:**
- Modify: `apps/worker/src/infra.ts`
- Create: `apps/worker/src/generate-image-handler.ts`
- Modify: `apps/worker/src/index.ts`

- [ ] **Step 1: Add generic `putBytes` to worker infra**

Modify `apps/worker/src/infra.ts`. Find the existing `putPdfBytes` function. After it (don't delete `putPdfBytes` — extraction handler uses it), add:

```ts
export async function putBytes(key: string, body: Buffer, contentType: string): Promise<void> {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }
  const path = join(localRoot, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}
```

Also add to the top-level export: `GENERATION_EVENTS_CHANNEL`. Append a constant at the bottom of `infra.ts`:

```ts
export const GENERATION_EVENTS_CHANNEL = "generation:events";
```

(The api package has its own copy of the same constant — string must match exactly.)

- [ ] **Step 2: Create handler**

Create `apps/worker/src/generate-image-handler.ts`:

```ts
import type { Job } from "bullmq";
import { db, schema } from "@studio/db";
import { generateImageVariant } from "@studio/ai";
import { priceImageUsage } from "@studio/ai";
import { eq } from "drizzle-orm";
import { GENERATION_EVENTS_CHANNEL, logger, putBytes, redisPub } from "./infra.js";

export type GenerateImageJob = {
  generationId: string;
  orgId: string;
  brandId: string;
  userId: string;
  groundedPrompt: string;
};

type VariantMeta = { index: number; s3Key: string; size: "1024x1024" };

export async function handleGenerateImage(job: Job<GenerateImageJob>) {
  const { generationId, orgId, brandId, userId, groundedPrompt } = job.data;
  const log = logger.child({
    generationId,
    jobId: job.id,
    attempt: job.attemptsMade + 1,
  });
  log.info("genimg:start");

  const t0 = Date.now();

  const tasks = [0, 1, 2].map(async (index) => {
    const { image, usage } = await generateImageVariant(groundedPrompt, {
      seed: 1000 + index,
    });
    const s3Key = `gen-${generationId}/${index}.png`;
    await putBytes(s3Key, Buffer.from(image), "image/png");
    await redisPub.publish(
      GENERATION_EVENTS_CHANNEL,
      JSON.stringify({
        generationId,
        event: "variant_ready",
        index,
        s3Key,
        size: "1024x1024",
      }),
    );
    return { index, s3Key, size: "1024x1024" as const, usage };
  });

  const results = await Promise.all(tasks);
  const totalCostUsd = results.reduce((s, r) => s + r.usage.costUsd, 0);
  const maxLatencyMs = Math.max(...results.map((r) => r.usage.latencyMs));
  const variants: VariantMeta[] = results.map(({ index, s3Key, size }) => ({
    index,
    s3Key,
    size,
  }));
  const output = { variants, model: "gpt-image-2", provider: "openai" } as const;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.generations)
      .set({ status: "done", output, completedAt: new Date() })
      .where(eq(schema.generations.id, generationId));
    await tx.insert(schema.usageEvents).values({
      orgId,
      brandId,
      userId,
      generationId,
      feature: "image",
      provider: "openai",
      model: "gpt-image-2",
      inputTokens: 0,
      outputTokens: 3,
      costUsd: totalCostUsd.toFixed(6),
      latencyMs: maxLatencyMs,
    });
  });

  await redisPub.publish(
    GENERATION_EVENTS_CHANNEL,
    JSON.stringify({ generationId, event: "done", output }),
  );
  log.info({ latencyMs: Date.now() - t0, costUsd: totalCostUsd }, "genimg:done");
}

export async function handleGenerateImageFailed(job: Job<GenerateImageJob>, errMsg: string) {
  const { generationId } = job.data;
  if ((job.attemptsMade ?? 0) < (job.opts.attempts ?? 1)) return;
  await db
    .update(schema.generations)
    .set({ status: "failed", error: errMsg, completedAt: new Date() })
    .where(eq(schema.generations.id, generationId));
  await redisPub.publish(
    GENERATION_EVENTS_CHANNEL,
    JSON.stringify({ generationId, event: "failed", error: errMsg }),
  );
  logger.error({ generationId, err: errMsg }, "genimg:final-fail");
}
```

(The unused `priceImageUsage` import isn't actually needed here — remove it. The worker's `usage.costUsd` already comes pre-computed from `generateImageVariant`.)

After review, **remove the `priceImageUsage` import line** from the file before committing.

- [ ] **Step 3: Register handler in worker bootstrap**

Replace `apps/worker/src/index.ts` with:

```ts
import { Worker } from "bullmq";
import {
  type ExtractProfileJob,
  handleExtractProfile,
  handleExtractProfileFailed,
} from "./extract-profile-handler.js";
import {
  type GenerateImageJob,
  handleGenerateImage,
  handleGenerateImageFailed,
} from "./generate-image-handler.js";
import { logger, redisQueue } from "./infra.js";

const extractWorker = new Worker<ExtractProfileJob>("extract-profile", handleExtractProfile, {
  connection: redisQueue,
  concurrency: 2,
});
extractWorker.on("failed", async (job, err) => {
  if (job) await handleExtractProfileFailed(job, err.message);
});
extractWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, queue: "extract-profile" }, "job:completed");
});

const imageWorker = new Worker<GenerateImageJob>("generate-image", handleGenerateImage, {
  connection: redisQueue,
  concurrency: 2,
});
imageWorker.on("failed", async (job, err) => {
  if (job) await handleGenerateImageFailed(job, err.message);
});
imageWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, queue: "generate-image" }, "job:completed");
});

logger.info("worker started: extract-profile, generate-image");
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/josorio/Code/superside/landing/demo
pnpm --filter @studio/worker typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/
git -c commit.gpgsign=false commit -m "feat(worker): generate-image handler + queue registration"
```

---

## Task 10: Web client — API + SSE hook

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/sse.ts`

- [ ] **Step 1: Add API methods**

Modify `apps/web/src/lib/api.ts`. Inside `api.generations` object, after the existing `get` method, add:

```ts
    createImage: (body: { prompt: string; brandId: string; layerName?: string }) =>
      req<{ id: string; status: "running" }>("/generations/image", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    eventsUrl: (id: string) => `/api/generations/${id}/events`,
```

- [ ] **Step 2: Add SSE hook**

Modify `apps/web/src/lib/sse.ts`. Append after the existing `useProfileEvents`:

```ts
export type GenerationVariant = { index: number; s3Key: string; size: string };

interface GenerationEventOpts {
  onVariantReady?: (v: GenerationVariant) => void;
  onDone?: (output: { variants: GenerationVariant[] }) => void;
  onFailed?: (msg: string) => void;
}

export function useGenerationEvents(
  generationId: string | undefined,
  opts: GenerationEventOpts,
) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!generationId) return;
    const es = new EventSource(`/api/generations/${generationId}/events`);

    const handleVariant = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { index: number; s3Key: string; size: string };
        optsRef.current.onVariantReady?.(parsed);
      } catch {}
    };
    const handleDone = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { output: { variants: GenerationVariant[] } };
        optsRef.current.onDone?.(parsed.output);
      } catch {}
    };
    const handleFailed = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { error?: string };
        optsRef.current.onFailed?.(parsed.error ?? "generation failed");
      } catch {
        optsRef.current.onFailed?.("generation failed");
      }
    };

    es.addEventListener("variant_ready", handleVariant as EventListener);
    es.addEventListener("done", handleDone as EventListener);
    es.addEventListener("failed", handleFailed as EventListener);

    return () => {
      es.removeEventListener("variant_ready", handleVariant as EventListener);
      es.removeEventListener("done", handleDone as EventListener);
      es.removeEventListener("failed", handleFailed as EventListener);
      es.close();
    };
  }, [generationId]);
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @studio/web typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/sse.ts
git -c commit.gpgsign=false commit -m "feat(web): generations.createImage + useGenerationEvents"
```

---

## Task 11: Rewrite `/plugin` route

**Files:**
- Rewrite: `apps/web/src/routes/plugin.tsx`

- [ ] **Step 1: Replace file contents**

Replace `apps/web/src/routes/plugin.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useGenerationEvents, type GenerationVariant } from "../lib/sse";
import "../features/plugin/plugin.css";

export const Route = createFileRoute("/plugin")({
  component: PluginPage,
});

type Status = "idle" | "running" | "done" | "failed";

function PluginPage() {
  const brandsQuery = useQuery({
    queryKey: ["brands"],
    queryFn: () => api.brands.list(),
  });
  const [brandId, setBrandId] = useState<string | null>(null);
  const profileQuery = useQuery({
    queryKey: ["brand", brandId],
    queryFn: () => api.brands.detail(brandId!),
    enabled: !!brandId,
  });

  useEffect(() => {
    if (!brandsQuery.data || brandId) return;
    const ready = brandsQuery.data.find((b) => b.profileStatus === "ready");
    setBrandId((ready ?? brandsQuery.data[0])?.id ?? null);
  }, [brandsQuery.data, brandId]);

  const [prompt, setPrompt] = useState("modern team collaboration, sunlit office");
  const [genId, setGenId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [variants, setVariants] = useState<GenerationVariant[]>([]);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profileReady = profileQuery.data?.currentProfile?.status === "ready";
  const canGenerate = !!brandId && profileReady && prompt.trim().length > 0;

  const generate = useMutation({
    mutationFn: () =>
      api.generations.createImage({
        brandId: brandId!,
        prompt: prompt.trim(),
        layerName: "hero-image",
      }),
    onMutate: () => {
      setStatus("running");
      setVariants([]);
      setAppliedIndex(null);
      setError(null);
    },
    onSuccess: (res) => setGenId(res.id),
    onError: (e: Error) => {
      setStatus("failed");
      setError(e.message);
    },
  });

  useGenerationEvents(genId ?? undefined, {
    onVariantReady: (v) =>
      setVariants((prev) => {
        if (prev.some((p) => p.index === v.index)) return prev;
        return [...prev, v].sort((a, b) => a.index - b.index);
      }),
    onDone: () => setStatus("done"),
    onFailed: (msg) => {
      setStatus("failed");
      setError(msg);
    },
  });

  const heroSrc = appliedIndex !== null && variants[appliedIndex]
    ? `/api/_storage/${encodeURIComponent(variants[appliedIndex].s3Key)}`
    : null;

  const palette = useMemo(
    () => profileQuery.data?.currentProfile?.profile?.visual.palette.slice(0, 5) ?? [],
    [profileQuery.data],
  );
  const sourceLabel =
    profileQuery.data?.currentProfile?.sourcePdfFilename ?? "hand-authored";
  const dotColor = palette[0]?.hex ?? "#E8714F";

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">plugin</p>
          <h1>Figma plugin</h1>
          <p className="subtitle">designer surface · live demo</p>
        </div>
      </header>

      <p className="plugin-caption">
        Brand-aware image generation via <span className="mono">gpt-image-2</span>. Generations
        persist to <span className="mono">generation</span> and <span className="mono">usage_event</span>{" "}
        — visible in History and Usage.
      </p>

      <section className="plugin-stage" aria-label="Studio Figma plugin">
        <div className="plugin-canvas" aria-hidden="true">
          <div className="canvas-grid"></div>
          <span className="canvas-label mono">slack-q2-ad.fig · page 1 · 100%</span>

          <article className="ad ad-square">
            <div className="ad-frame-label mono">hero-image · 1080 × 1080</div>
            <div className="ad-image">
              {heroSrc && <img src={heroSrc} alt="" />}
            </div>
            <div className="ad-band">
              <p className="ad-eyebrow mono">slack · q2 · en-US</p>
              <h4 className="ad-headline">Where work happens.</h4>
              <span className="ad-cta">
                <span>Try Slack</span>
              </span>
            </div>
          </article>
        </div>

        <div className="plugin-panel">
          <header className="panel-head">
            <div className="panel-mark">
              <span className="ws-mark" aria-hidden="true"></span>
              <span className="panel-title">Studio</span>
            </div>
            <BrandPill
              brands={brandsQuery.data ?? []}
              selectedId={brandId}
              dotColor={dotColor}
              onChange={(id) => {
                setBrandId(id);
                setVariants([]);
                setAppliedIndex(null);
                setStatus("idle");
                setGenId(null);
                setError(null);
              }}
            />
          </header>

          <nav className="panel-tabs" aria-label="Plugin actions">
            <button type="button">Copy</button>
            <button type="button">Translate</button>
            <button type="button" data-active="">Image</button>
          </nav>

          <div className="panel-body">
            <section className="layer-card">
              <div className="layer-thumb" aria-hidden="true">
                {heroSrc && <img src={heroSrc} alt="" />}
              </div>
              <div className="layer-meta">
                <p className="layer-name">hero-image</p>
                <p className="layer-sub mono">frame · 1024 × 1024</p>
              </div>
              <span className="layer-tag mono">selected</span>
            </section>

            {error && (
              <div className="gen-error" role="alert">
                {error} ·{" "}
                <button type="button" className="prompt-cta" onClick={() => generate.mutate()}>
                  Try again
                </button>
              </div>
            )}

            <section className="prompt-field">
              <label className="field-label mono" htmlFor="prompt-textarea">
                Prompt
              </label>
              <div className="prompt-box">
                <textarea
                  id="prompt-textarea"
                  value={prompt}
                  maxLength={200}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                />
                <div className="prompt-foot">
                  <span className="mono">{prompt.length} / 200</span>
                  <button
                    type="button"
                    className="prompt-cta"
                    onClick={() => generate.mutate()}
                    disabled={!canGenerate || status === "running"}
                  >
                    {status === "running" ? "Generating…" : "Regenerate"}
                  </button>
                </div>
              </div>
              {!profileReady && brandId && (
                <p className="prompt-hint mono">brand profile not ready</p>
              )}
            </section>

            {status !== "idle" && (
              <section className="variants-section">
                <div className="variants-head">
                  <span className="field-label mono">3 variants · gpt-image-2</span>
                </div>
                <div className="variants-grid">
                  {[0, 1, 2].map((i) => {
                    const v = variants.find((x) => x.index === i);
                    return (
                      <button
                        key={i}
                        type="button"
                        className="variant"
                        data-applied={appliedIndex === i ? "" : null}
                        disabled={!v}
                        onClick={() => v && setAppliedIndex(i)}
                      >
                        {v ? (
                          <img
                            className="variant-img"
                            src={`/api/_storage/${encodeURIComponent(v.s3Key)}`}
                            alt={`variant ${i + 1}`}
                          />
                        ) : (
                          <div className="variant-skeleton" aria-label="loading variant" />
                        )}
                        {appliedIndex === i && <span className="variant-badge mono">applied</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="brand-context">
              <span className="field-label mono">grounded in</span>
              <div className="ctx-row">
                <span className="ctx-pill mono">{sourceLabel}</span>
                {palette.length > 0 && (
                  <div className="palette-row" aria-hidden="true">
                    {palette.map((p) => (
                      <span key={p.hex} className="ps" style={{ background: p.hex }}></span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          <footer className="panel-foot">
            <span className="user-line">
              <span className="user-dot">J</span>
              <span className="mono">jo · DesignTechCo</span>
            </span>
            <span className="conn mono">
              <span className="conn-dot"></span>
              connected
            </span>
          </footer>
        </div>
      </section>

      <p className="plugin-footnote">Designer surface — Figma plugin demo.</p>
    </>
  );
}

function BrandPill(props: {
  brands: { id: string; name: string }[];
  selectedId: string | null;
  dotColor: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = props.brands.find((b) => b.id === props.selectedId);
  return (
    <div className="brand-pill-wrap">
      <button
        type="button"
        className="brand-pill"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="brand-dot" style={{ background: props.dotColor }}></span>
        {selected?.name ?? "Pick brand"}
      </button>
      {open && (
        <ul className="brand-menu" role="listbox">
          {props.brands.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                role="option"
                aria-selected={b.id === props.selectedId}
                onClick={() => {
                  props.onChange(b.id);
                  setOpen(false);
                }}
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @studio/web typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/plugin.tsx
git -c commit.gpgsign=false commit -m "feat(web): interactive /plugin route — prompt, brand, variants, apply"
```

---

## Task 12: Plugin CSS — layout, variants, skeleton, textarea, errors

**Files:**
- Modify: `apps/web/src/features/plugin/plugin.css`

- [ ] **Step 1: Apply diffs**

Open `apps/web/src/features/plugin/plugin.css`. Make these changes:

**(a)** Bump stage size + panel width. Find `.plugin-stage { ... min-height: 480px; max-width: 1100px; }` and replace those two values:
```css
.plugin-stage {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 10;
  background: oklch(22% 0.008 280);
  box-shadow: var(--shadow-mockup);
  min-height: 620px;
  max-width: 1200px;
}
```

**(b)** Find `.plugin-panel { ... width: clamp(300px, 38%, 360px); ... }` — bump width:
```css
  width: clamp(340px, 40%, 400px);
```

**(c)** Find `.panel-body { ... overflow: hidden; }` — change to scroll:
```css
.panel-body {
  flex: 1;
  padding: 0.85rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  overflow-y: auto;
}
```

**(d)** Append the following at the end of the file (before the `@media (max-width: 720px)` block):

```css
.plugin-canvas .ad-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.layer-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.prompt-box textarea {
  width: 100%;
  background: transparent;
  border: 0;
  resize: none;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11.5px;
  color: oklch(94% 0.005 60);
  line-height: 1.4;
  min-height: 2.6em;
  outline: none;
  padding: 0;
  margin: 0 0 0.5rem;
}

.prompt-cta:disabled {
  color: oklch(40% 0.006 280);
  cursor: not-allowed;
}

.prompt-hint {
  margin: 0.3rem 0 0;
  font-size: 9.5px;
  color: oklch(70% 0.06 25);
}

.gen-error {
  background: oklch(28% 0.06 25);
  border: 1px solid oklch(50% 0.13 25);
  border-radius: 3px;
  padding: 0.4rem 0.55rem;
  font-size: 10.5px;
  color: oklch(92% 0.04 25);
}

.variants-section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.variants-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.variants-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}
.variant {
  position: relative;
  aspect-ratio: 1;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid oklch(30% 0.008 280);
  cursor: pointer;
  background: oklch(40% 0.02 50);
  padding: 0;
}
.variant:disabled {
  cursor: default;
}
.variant[data-applied] {
  border-color: var(--color-coral);
  box-shadow: 0 0 0 1px var(--color-coral);
}
.variant-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.variant-badge {
  position: absolute;
  bottom: 3px;
  left: 3px;
  font-size: 8.5px;
  color: oklch(96% 0.005 60);
  background: oklch(0% 0 0 / 0.6);
  padding: 0.1rem 0.3rem;
  border-radius: 2px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.variant-skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg,
    oklch(28% 0.008 280) 0%,
    oklch(34% 0.008 280) 50%,
    oklch(28% 0.008 280) 100%);
  background-size: 200% 100%;
  animation: plugin-shimmer 1.4s ease-in-out infinite;
}
@keyframes plugin-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.brand-pill-wrap {
  position: relative;
  justify-self: end;
}
.brand-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  background: oklch(18% 0.006 280);
  border: 1px solid oklch(30% 0.008 280);
  border-radius: 4px;
  min-width: 140px;
  z-index: 5;
  box-shadow: 0 8px 20px oklch(0% 0 0 / 0.5);
}
.brand-menu li button {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  color: oklch(92% 0.005 60);
  font-family: var(--font-sans);
  font-size: 11px;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  border-radius: 2px;
}
.brand-menu li button:hover,
.brand-menu li button[aria-selected="true"] {
  background: oklch(24% 0.008 280);
}

.ad-image {
  background: linear-gradient(135deg, oklch(45% 0.05 50), oklch(40% 0.04 60));
}
```

(The last `.ad-image` rule replaces the existing inline gradient with the same gradient as a default — no behavior change, just centralized.)

- [ ] **Step 2: Run dev, smoke check styles**

```bash
cd /Users/josorio/Code/superside/landing/demo
pnpm dev
```
Open http://localhost:5173/plugin in browser. Expected: panel is wider, stage is taller, prompt is editable, brand pill opens a menu on click, no variants section visible (status='idle').

Stop dev with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/plugin/plugin.css
git -c commit.gpgsign=false commit -m "style(web): plugin layout, variants, skeleton, textarea, errors"
```

---

## Task 13: Playwright E2E test (fixture-driven, no real OpenAI)

**Files:**
- Create: `e2e/tests/plugin.spec.ts`

- [ ] **Step 1: Write the test**

Create `e2e/tests/plugin.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("/plugin", () => {
  test("brand selector + textarea + variant generation + apply", async ({ page }) => {
    // Stub brands list
    await page.route("**/api/brands", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "11111111-1111-1111-1111-111111111111",
            orgId: "org-1",
            name: "Slack",
            deletedAt: null,
            createdAt: new Date().toISOString(),
            genCount30d: 0,
            lastActivityAt: null,
            profileStatus: "ready",
          },
        ]),
      }),
    );

    // Stub brand detail with a ready profile
    await page.route("**/api/brands/11111111-1111-1111-1111-111111111111", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          brand: {
            id: "11111111-1111-1111-1111-111111111111",
            orgId: "org-1",
            name: "Slack",
            deletedAt: null,
            createdAt: new Date().toISOString(),
          },
          currentProfile: {
            id: "p1",
            orgId: "org-1",
            brandId: "11111111-1111-1111-1111-111111111111",
            version: 1,
            status: "ready",
            profile: {
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
            },
            sourcePdfS3Key: "profiles/slack.pdf",
            sourcePdfFilename: "slack-brand-v3.pdf",
            sourcePdfSizeBytes: 12345,
            ingestError: null,
            isCurrent: true,
            createdBy: null,
            createdAt: new Date().toISOString(),
          },
          stats: { genCount30d: 0, lastActivityAt: null },
        }),
      }),
    );

    // Stub POST /generations/image
    await page.route("**/api/generations/image", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "gen-abc", status: "running" }),
      }),
    );

    // Stub SSE — emit 3 variant_ready then done
    await page.route("**/api/generations/gen-abc/events", (route) => {
      const body = [
        `event: open\ndata: {"generationId":"gen-abc"}\n\n`,
        `event: variant_ready\ndata: {"index":0,"s3Key":"gen-abc/0.png","size":"1024x1024"}\n\n`,
        `event: variant_ready\ndata: {"index":1,"s3Key":"gen-abc/1.png","size":"1024x1024"}\n\n`,
        `event: variant_ready\ndata: {"index":2,"s3Key":"gen-abc/2.png","size":"1024x1024"}\n\n`,
        `event: done\ndata: {"output":{"variants":[{"index":0,"s3Key":"gen-abc/0.png","size":"1024x1024"},{"index":1,"s3Key":"gen-abc/1.png","size":"1024x1024"},{"index":2,"s3Key":"gen-abc/2.png","size":"1024x1024"}],"model":"gpt-image-2","provider":"openai"}}\n\n`,
      ].join("");
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache" },
        body,
      });
    });

    // Stub the storage proxy so <img src> resolves to a 1×1 PNG
    const onePx = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );
    await page.route("**/api/_storage/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: onePx }),
    );

    // Stub /api/me (used by app shell)
    await page.route("**/api/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ orgId: "org-1", userId: "u-1" }),
      }),
    );

    await page.goto("/plugin");

    // Brand pill shows Slack
    await expect(page.getByRole("button", { name: /Slack/ })).toBeVisible();

    // Prompt textarea is editable
    const ta = page.getByLabel("Prompt");
    await expect(ta).toBeVisible();
    await ta.fill("a serene office");
    await expect(page.getByText("16 / 200")).toBeVisible();

    // Click Regenerate
    await page.getByRole("button", { name: /Regenerate/ }).click();

    // Wait for 3 variants to render
    const variants = page.locator(".variant");
    await expect(variants).toHaveCount(3);
    // Each variant should eventually have an img
    await expect(variants.nth(0).locator("img")).toBeVisible();
    await expect(variants.nth(1).locator("img")).toBeVisible();
    await expect(variants.nth(2).locator("img")).toBeVisible();

    // Click variant 1 to apply
    await variants.nth(1).click();
    await expect(variants.nth(1)).toHaveAttribute("data-applied", "");

    // Hero image inside the canvas should now have a src
    const heroImg = page.locator(".plugin-canvas .ad-image img");
    await expect(heroImg).toHaveAttribute("src", /api\/_storage/);
  });

  test("Regenerate disabled when prompt empty", async ({ page }) => {
    await page.route("**/api/brands", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "11111111-1111-1111-1111-111111111111",
            orgId: "org-1",
            name: "Slack",
            deletedAt: null,
            createdAt: new Date().toISOString(),
            genCount30d: 0,
            lastActivityAt: null,
            profileStatus: "ready",
          },
        ]),
      }),
    );
    await page.route("**/api/brands/11111111-*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          brand: { id: "11111111-1111-1111-1111-111111111111", orgId: "org-1", name: "Slack", deletedAt: null, createdAt: new Date().toISOString() },
          currentProfile: {
            id: "p1", orgId: "org-1", brandId: "11111111-1111-1111-1111-111111111111", version: 1,
            status: "ready",
            profile: {
              brand_name: "Slack",
              voice: { tone_descriptors: [], voice_principles: [], do: [], dont: [] },
              visual: { palette: [], typography: { display: null, body: null, mono: null }, logo_usage: [] },
              localization: { locales: [], notes: null }, banned_terms: [],
            },
            sourcePdfS3Key: null, sourcePdfFilename: null, sourcePdfSizeBytes: null,
            ingestError: null, isCurrent: true, createdBy: null, createdAt: new Date().toISOString(),
          },
          stats: { genCount30d: 0, lastActivityAt: null },
        }),
      }),
    );
    await page.route("**/api/me", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orgId: "org-1", userId: "u-1" }) }),
    );

    await page.goto("/plugin");
    const ta = page.getByLabel("Prompt");
    await ta.fill("");
    await expect(page.getByRole("button", { name: /Regenerate/ })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd /Users/josorio/Code/superside/landing/demo
pnpm --filter @studio/e2e exec playwright test plugin.spec.ts
```
Expected: PASS for both tests. (If `--filter @studio/e2e` doesn't match, look in `e2e/package.json` for the actual `name` field and use it.)

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/plugin.spec.ts
git -c commit.gpgsign=false commit -m "test(e2e): plugin route — fixture-driven SSE + apply flow"
```

---

## Task 14: curl integration smoke script

**Files:**
- Create: `scripts/smoke-plugin.sh`
- Modify: `package.json` (add `smoke:plugin` script)
- Modify: `README.md`

- [ ] **Step 1: Write smoke script**

Create `scripts/smoke-plugin.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:3001}"
PROMPT="${PROMPT:-modern team office, sunlit}"

echo "==> picking first ready brand…"
BRAND_ID=$(curl -sS "$API/api/brands" | jq -r '.[] | select(.profileStatus == "ready") | .id' | head -1)
if [ -z "$BRAND_ID" ]; then
  echo "no brand with ready profile found — seed/run extraction first" >&2
  exit 1
fi
echo "    brandId=$BRAND_ID"

echo "==> POST /api/generations/image…"
GEN_ID=$(curl -sS -X POST "$API/api/generations/image" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg p "$PROMPT" --arg b "$BRAND_ID" \
    '{prompt:$p,brandId:$b,layerName:"hero-image"}')" \
  | jq -r .id)
echo "    generationId=$GEN_ID"

echo "==> polling status (60s timeout)…"
deadline=$(( $(date +%s) + 60 ))
while :; do
  json=$(curl -sS "$API/api/generations/$GEN_ID")
  s=$(echo "$json" | jq -r .status)
  echo "    status=$s"
  [ "$s" = "done" ] && break
  if [ "$s" = "failed" ]; then
    echo "FAILED: $(echo "$json" | jq -r .error)" >&2
    exit 1
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "TIMEOUT after 60s" >&2
    exit 1
  fi
  sleep 2
done

echo "==> asserting 3 variants…"
n=$(echo "$json" | jq '.output.variants | length')
if [ "$n" != "3" ]; then
  echo "expected 3 variants, got $n" >&2
  exit 1
fi

echo "==> asserting first variant served by storage proxy…"
KEY=$(echo "$json" | jq -r '.output.variants[0].s3Key')
ct=$(curl -sSI "$API/api/_storage/$KEY" | grep -i '^content-type:' | awk '{print $2}' | tr -d '\r')
case "$ct" in
  image/png*) echo "    content-type=$ct" ;;
  *) echo "expected image/png, got $ct" >&2; exit 1 ;;
esac

echo "==> asserting usage rollup includes image feature with non-zero cost…"
curl -sS "$API/api/usage?groupBy=feature&days=1" \
  | jq -e '.[] | select(.key == "image") | (.costUsd | tonumber > 0)' >/dev/null

echo "==> SMOKE OK · generationId=$GEN_ID"
```

Make executable:
```bash
chmod +x /Users/josorio/Code/superside/landing/demo/scripts/smoke-plugin.sh
```

- [ ] **Step 2: Add pnpm script**

In `package.json` (root of `demo/`), add to `"scripts"`:
```json
    "smoke:plugin": "bash scripts/smoke-plugin.sh"
```

- [ ] **Step 3: Document in README**

In `demo/README.md`, find the existing scripts section (or add one near the top after install instructions). Append:

```markdown
### Plugin smoke test

End-to-end smoke against a running stack (api + worker + redis + postgres + s3 + at least one brand with a `ready` profile). Hits real OpenAI — costs ~$0.12/run.

```bash
pnpm dev   # in another terminal
pnpm smoke:plugin
```
```

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-plugin.sh package.json README.md
git -c commit.gpgsign=false commit -m "test(smoke): curl-driven /plugin integration smoke"
```

---

## Task 15: Manual verification + final commit

- [ ] **Step 1: Bring up local stack**

```bash
cd /Users/josorio/Code/superside/landing/demo
pnpm dev
```
Expected: api on 3001, web on 5173, worker logs `worker started: extract-profile, generate-image`.

If no brand with ready profile exists, run the seed and any extraction needed (see existing `scripts/seed.ts`).

- [ ] **Step 2: Manual smoke**

In browser at `http://localhost:5173/plugin`:
1. Brand pill shows a ready brand. Switching brands works.
2. Edit prompt — char counter updates live.
3. Click Regenerate → 3 skeleton tiles → real OpenAI variants fill in over ~6-15s.
4. Click variant 2 → coral border + badge, hero canvas image swaps.
5. Click variant 0 → hero swaps again.
6. Visit `/generations` → new row, type=image, status=done, output has 3 variants.
7. Visit `/usage` → image feature row with non-zero cost.

- [ ] **Step 3: curl smoke**

In a second terminal:
```bash
cd /Users/josorio/Code/superside/landing/demo
pnpm smoke:plugin
```
Expected: `==> SMOKE OK · generationId=<uuid>`.

- [ ] **Step 4: Failure smoke**

Stop the worker. Click Regenerate in browser. After ~60s + retries, the SSE `failed` event hits the UI — error banner appears. Restart worker.

- [ ] **Step 5: Final repo commit (housekeeping)**

If any incidental files changed (lockfile, etc.), commit:
```bash
git status --short
git add <files-as-needed>
git -c commit.gpgsign=false commit -m "chore: lockfile + misc after plugin work"
```

---

## Self-review notes

**Spec coverage check:**
- Editable prompt + brand selector → Task 11.
- gpt-image-2 via OpenAI direct → Task 4.
- Persistence to generation + usage_event → Task 9 (worker writes both inside one tx).
- Async via BullMQ + per-variant SSE → Tasks 6, 9, 10.
- S3 storage via existing proxy → Task 9 (worker uses `putBytes`); web reads via `/api/_storage/<key>` (Task 11).
- Layout grow → Task 12.
- Editable textarea, always Regenerate, fresh on mount, client-only apply → Task 11.
- Brand selector functional + grounding server-side → Tasks 7 + 11.
- One generation row, three parallel calls → Task 9.
- Tests: Playwright fixture-driven + curl smoke → Tasks 13 + 14.

**Type consistency check:**
- `GenerationVariant` shape (`{ index, s3Key, size }`) consistent across worker output, SSE event, web hook, and route component.
- `priceImageUsage({model, imageCount})` signature used identically in `generate-image.ts` (Task 4) and pricing.ts (Task 2). The worker doesn't re-call it (each variant comes pre-priced).
- `CreateImageGenerationSchema` field names (`prompt`, `brandId`, `layerName`) match: web `api.generations.createImage` body (Task 10), router validator (Task 8), service body type (Task 7).

**Placeholder scan:** none.

**Open issue noted:** if `gpt-image-2` is not yet supported by the installed `@ai-sdk/openai` version, the runtime call in Task 4 will throw at startup. Fallback: change the model string to `"gpt-image-1"` in `generate-image.ts` and pricing.ts (search-replace). This is the only model-name surface area.
