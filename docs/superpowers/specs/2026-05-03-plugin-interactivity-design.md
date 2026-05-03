# Plugin demo — image generation interactivity (design)

**Date:** 2026-05-03
**Scope:** make the `/plugin` route in `landing/demo/apps/web` functional end-to-end for the **Image** tab. Real `gpt-image-2` calls via OpenAI direct, real Postgres + S3 + BullMQ + SSE, brand grounding from the loaded `brand_profile`.
**Out of scope:** Copy and Translate tabs, real Figma plugin runtime, applied-variant persistence, variant cleanup on retry, rate limits.

## Goal

Today the `/plugin` route is a captioned static visual — `lib/api.ts` has no image endpoint, the prompt is a `<p>`, no Generate behavior. Caption claims the platform writes plugin-originating rows to `generation` and `usage_event` "visible in History and Usage." That claim is currently a lie.

Make the caption true:

1. Editable prompt textarea + working brand selector.
2. Click Regenerate → real `gpt-image-2` call, 3 variants, persisted to `generation` + `usage_event`, visible in `/generations` and `/usage`.
3. Streamed delivery: 3 skeletons that settle one-by-one as each variant lands.
4. Click variant → applies to hero canvas image (client-only state, not persisted).
5. Brand selector pulls from `/api/brands`. Selected brand's profile grounds the prompt server-side (palette + logo guidance appended).

## Locked decisions (from brainstorm)

| # | Decision |
|---|----------|
| 1 | Image tab only. Copy / Translate stay static placeholders. |
| 2 | Provider: **OpenAI direct** (`@ai-sdk/openai`, new `OPENAI_API_KEY` env). Matches architecture-doc default. |
| 3 | Persist: insert `generation` row + one `usage_event` row per generate click (3 variants aggregated). |
| 4 | Async: BullMQ job + SSE per-variant events. Mirrors `extract-profile-handler`. |
| 5 | Storage: S3 (LocalStack) via existing `putObject`/`getPdf`-style infra. Web fetches via `/api/_storage/<key>`. |
| 6 | Layout: grow stage `min-height` 480→620px, panel width clamp(340, 40%, 400). Page taller. |
| 7 | UX: editable textarea (max 200 chars), button always "Regenerate", fresh state on `/plugin` mount. Apply is client-only. |
| 8 | Brand selector functional. Default brand = first whose `profileStatus === 'ready'`. Switching brand resets variants, keeps prompt. |
| 9 | Brand grounding: server appends palette + logo guideline to user prompt. Stored alongside raw prompt in `generation.input`. |
| 10 | One generation row per click. 3 parallel `experimental_generateImage({n:1, seed:i})` calls inside the worker. |

## Architecture

```
[/plugin route]                      [api]                       [worker]                     [openai]
   |  POST /api/generations/image                                    
   |  { prompt, brandId, layerName }                                 
   |───────────────────────────────────>|                                                       
   |                                    | INSERT generation row                                 
   |                                    |   status='running' output=null                        
   |                                    | enqueue BullMQ "generate-image" job                   
   |   201 { id, status: 'running' }    |                                                       
   |<───────────────────────────────────|                                                       
   |                                                                                            
   |  GET /api/generations/:id/events (SSE)                                                     
   |───────────────────────────────────>|  subscribe(GENERATION_EVENTS, gen:<id>)                
   |                                                                                            
   |                                    |              [job picked up]──────►  generateImage(n=1, seed=A)
   |                                    |                                ──►  generateImage(n=1, seed=B)
   |                                    |                                ──►  generateImage(n=1, seed=C)
   |                                    |               ◄────each resolves────│
   |                                    |   PUT s3://.../gen-<id>/<i>.png      
   |                                    |   PUBLISH variant_ready{i,key}       
   |   ◄── event:variant_ready {0,key} ─|                                      
   |   ◄── event:variant_ready {1,key} ─|                                      
   |   ◄── event:variant_ready {2,key} ─|                                      
   |                                    |   UPDATE generation set output={variants:[..]} status='done'
   |                                    |   INSERT usage_event (sum of 3 calls)                  
   |                                    |   PUBLISH done                                         
   |   ◄── event:done {output} ─────────|                                                        
   |                                                                                            
   |  [user clicks variant]
   |  hero-canvas <img src> = /api/_storage/<key>
```

## Data model — no migration

Existing `generation` table accommodates this as-is. `output` is JSONB.

**On POST:**
```json
{
  "id": "<uuid>",
  "orgId": "...",
  "brandId": "...",
  "userId": "...",
  "type": "image",
  "status": "running",
  "input": {
    "prompt": "<user text, ≤200 chars>",
    "groundedPrompt": "<user text + brand-derived block>",
    "brandId": "...",
    "layerName": "hero-image",
    "layerSize": "1024x1024",
    "profileVersion": 3
  },
  "output": null,
  "startedAt": "<now>",
  "figmaFileKey": null,
  "figmaNodeId": null
}
```

**Worker on done:**
```json
{
  "status": "done",
  "output": {
    "variants": [
      { "index": 0, "s3Key": "gen-<id>/0.png", "size": "1024x1024" },
      { "index": 1, "s3Key": "gen-<id>/1.png", "size": "1024x1024" },
      { "index": 2, "s3Key": "gen-<id>/2.png", "size": "1024x1024" }
    ],
    "model": "gpt-image-2",
    "provider": "openai"
  },
  "completedAt": "<now>"
}
```

**Worker on failure (after retries exhausted):**
```json
{ "status": "failed", "error": "<message>", "completedAt": "<now>" }
```

**Usage event** — one row per generation, not per variant:
```json
{
  "orgId": "...",
  "brandId": "...",
  "userId": "...",
  "generationId": "<id>",
  "feature": "image",
  "provider": "openai",
  "model": "gpt-image-2",
  "inputTokens": 0,
  "outputTokens": 3,
  "costUsd": "<sum of 3 calls>",
  "latencyMs": "<max of 3 calls>"
}
```

## API contract

### `POST /api/generations/image`

Request:
```json
{
  "prompt": "modern team collaboration, sunlit office",
  "brandId": "<uuid>",
  "layerName": "hero-image"
}
```

Validation (`@studio/schemas` new `CreateImageGenerationSchema`):
- `prompt`: trimmed, length 1..200
- `brandId`: uuid, must exist for org, must have a `currentProfile` with `status === 'ready'`
- `layerName`: optional, default `'untitled'`

Responses:
- `201 { "id": "<uuid>", "status": "running" }`
- `400` validation
- `404` brand not found / not in org
- `409` brand has no ready profile

### `GET /api/generations/:id/events` (SSE)

Org-scoped. `404` if not found / different org.

Events:
| Event | Payload |
|-------|---------|
| `open` | `{ generationId }` |
| `variant_ready` | `{ index, s3Key, size }` — emitted up to 3× |
| `done` | `{ output: { variants, model, provider } }` |
| `failed` | `{ error }` |
| `: keepalive` | every 25s (comment frame) |

### Storage proxy — no change

Existing `GET /api/_storage/<key>` already serves S3 objects (used today for PDFs). Worker writes keys as `gen-<generationId>/<index>.png`.

## Brand grounding

```ts
function buildGroundedPrompt(userPrompt: string, profile: BrandProfile): string {
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

Stored as `input.groundedPrompt` for History/eval visibility. Style: template literals only — no `array.filter(Boolean).join("\n")`.

## Worker handler

```ts
// apps/worker/src/generate-image-handler.ts
export type GenerateImageJob = {
  generationId: string;
  orgId: string;
  brandId: string;
  userId: string;
  groundedPrompt: string;
};

export async function handleGenerateImage(job: Job<GenerateImageJob>) {
  const { generationId, orgId, brandId, userId, groundedPrompt } = job.data;
  const log = logger.child({ generationId, jobId: job.id });
  log.info("genimg:start");

  const tasks = [0, 1, 2].map(async (index) => {
    const { image, usage } = await generateImageVariant(groundedPrompt, { seed: 1000 + index });
    const s3Key = `gen-${generationId}/${index}.png`;
    await putObject(s3Key, image, "image/png");
    await redisPub.publish(
      GENERATION_EVENTS_CHANNEL,
      JSON.stringify({ generationId, event: "variant_ready", index, s3Key, size: "1024x1024" })
    );
    return { index, s3Key, size: "1024x1024" as const, usage };
  });

  const results = await Promise.all(tasks);
  const totalCostUsd = results.reduce((s, r) => s + r.usage.costUsd, 0);
  const maxLatencyMs = Math.max(...results.map(r => r.usage.latencyMs));
  const variants = results.map(({ index, s3Key, size }) => ({ index, s3Key, size }));

  await db.transaction(async (tx) => {
    await tx.update(schema.generations).set({
      status: "done",
      output: { variants, model: "gpt-image-2", provider: "openai" },
      completedAt: new Date(),
    }).where(eq(schema.generations.id, generationId));

    await tx.insert(schema.usageEvents).values({
      orgId, brandId, userId, generationId,
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
    JSON.stringify({ generationId, event: "done", output: { variants, model: "gpt-image-2", provider: "openai" } })
  );
  log.info({ latencyMs: maxLatencyMs, costUsd: totalCostUsd }, "genimg:done");
}

export async function handleGenerateImageFailed(job: Job<GenerateImageJob>, errMsg: string) {
  if ((job.attemptsMade ?? 0) < (job.opts.attempts ?? 1)) return;
  await db.update(schema.generations).set({
    status: "failed",
    error: errMsg,
    completedAt: new Date(),
  }).where(eq(schema.generations.id, job.data.generationId));
  await redisPub.publish(GENERATION_EVENTS_CHANNEL, JSON.stringify({
    generationId: job.data.generationId, event: "failed", error: errMsg,
  }));
}
```

## `packages/ai/src/generate-image.ts`

```ts
import { experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import { priceUsage } from "./pricing.js";

export async function generateImageVariant(prompt: string, opts: { seed: number }) {
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
    const latencyMs = Date.now() - t0;
    return {
      image: image.uint8Array,
      usage: {
        provider: "openai" as const,
        model: "openai/gpt-image-2" as const,
        inputTokens: 0,
        outputTokens: 1,
        costUsd: priceUsage("openai/gpt-image-2", 0, 1),
        latencyMs,
      },
    };
  } finally {
    clearTimeout(to);
  }
}
```

New deps in `packages/ai/package.json`: `@ai-sdk/openai`. (`ai` already there.)

## Frontend (`/plugin` route)

### State

```ts
type Variant = { index: 0 | 1 | 2; s3Key: string; size: string };
type GenStatus = 'idle' | 'running' | 'done' | 'failed';

const brandsQuery = useQuery({ queryKey: ['brands'], queryFn: () => api.brands.list() });
const [brandId, setBrandId] = useState<string | null>(null);
const profileQuery = useQuery({
  queryKey: ['brand', brandId],
  queryFn: () => api.brands.detail(brandId!),
  enabled: !!brandId,
});

const [prompt, setPrompt] = useState('modern team collaboration, sunlit office');
const [genId, setGenId] = useState<string | null>(null);
const [status, setStatus] = useState<GenStatus>('idle');
const [variants, setVariants] = useState<Variant[]>([]);
const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
const [error, setError] = useState<string | null>(null);
```

Default `brandId` set in a `useEffect` after brands load: first `profileStatus==='ready'` brand, fallback first.

### Generate flow

```ts
const generate = useMutation({
  mutationFn: () => api.generations.createImage({ brandId: brandId!, prompt, layerName: 'hero-image' }),
  onMutate: () => { setStatus('running'); setVariants([]); setAppliedIndex(null); setError(null); },
  onSuccess: (res) => setGenId(res.id),
  onError: (e) => { setStatus('failed'); setError(e.message); },
});

useGenerationSSE(genId, {
  onVariantReady: (v) => setVariants(prev => [...prev, v].sort((a, b) => a.index - b.index)),
  onDone: () => setStatus('done'),
  onFailed: (errMsg) => { setStatus('failed'); setError(errMsg); },
});
```

`useGenerationSSE` lives in `apps/web/src/lib/sse.ts` next to existing helpers.

### UI mapping

| Element | Behavior |
|---------|----------|
| Brand pill | Radix `DropdownMenu`. Items = brands list. Dot color = `currentProfile.visual.palette[0].hex` or coral fallback. |
| Prompt | `<textarea maxLength={200}>` with live `{prompt.length} / 200` counter. |
| Regenerate | Disabled when `status==='running'` or `!canGenerate`. Shows spinner + "Generating…" while running. |
| Variants section | Only renders when `status !== 'idle'`. 3 slots — skeleton until variant arrives, then `<img>`. |
| Variant click | `setAppliedIndex(i)` → coral border + `applied` badge → hero canvas `<img src>` swaps. |
| Cost line | `3 variants · gpt-image-2` left, `<latency>s · $<cost>` right. Hidden during running. |
| Failure banner | `gen-error` box above prompt with message + Try-again. |

`canGenerate = brandId && profileQuery.data?.currentProfile?.status === 'ready' && prompt.trim().length > 0`.

### Disabled-state matrix

| Condition | UI |
|-----------|-----|
| No brands in org | textarea disabled, banner: "Create a brand first" → link `/brands` |
| Brand selected, profile `processing` | button disabled, label "Profile processing…" |
| Brand selected, profile `failed` / null | button disabled, label "Brand profile not ready" |
| Profile `ready`, prompt valid | button enabled |

## CSS deltas

```css
.plugin-stage { min-height: 620px; max-width: 1200px; }
.plugin-panel { width: clamp(340px, 40%, 400px); }
.panel-body { overflow-y: auto; }

.variants-section { display: flex; flex-direction: column; gap: 0.45rem; }
.variants-head { display: flex; justify-content: space-between; align-items: baseline; }
.variants-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; }
.variant {
  position: relative;
  aspect-ratio: 1;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid oklch(30% 0.008 280);
  cursor: pointer;
  background: oklch(40% 0.02 50);
}
.variant[data-applied] {
  border-color: var(--color-coral);
  box-shadow: 0 0 0 1px var(--color-coral);
}
.variant-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.variant-badge { /* port from PluginMockup.astro */ }

.variant-skeleton {
  background: linear-gradient(90deg,
    oklch(28% 0.008 280) 0%,
    oklch(34% 0.008 280) 50%,
    oklch(28% 0.008 280) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
}

.gen-error {
  background: oklch(28% 0.06 25);
  border: 1px solid oklch(50% 0.13 25);
  border-radius: 3px;
  padding: 0.4rem 0.55rem;
  font-size: 10.5px;
  color: oklch(92% 0.04 25);
}
```

Mobile breakpoint at 720px stays — panel goes full-width, ad hides.

## Files touched

| File | Change |
|------|--------|
| `landing/demo/.env`, `.env.example` | Add `OPENAI_API_KEY` |
| `landing/demo/packages/ai/package.json` | Add `@ai-sdk/openai` |
| `landing/demo/packages/ai/src/generate-image.ts` | NEW |
| `landing/demo/packages/ai/src/index.ts` | Export new fn |
| `landing/demo/packages/schemas/src/generation.ts` | Add `CreateImageGenerationSchema` |
| `landing/demo/apps/api/src/infra/redis.ts` | Add `GENERATION_EVENTS_CHANNEL` constant |
| `landing/demo/apps/api/src/infra/sse.ts` | Add `streamGenerationEvents(c, generationId)` |
| `landing/demo/apps/api/src/routes/generation/router.ts` | Add `POST /image`, `GET /:id/events` |
| `landing/demo/apps/api/src/routes/generation/service.ts` | NEW — orchestration (validate brand+profile, insert row, enqueue job) |
| `landing/demo/apps/worker/src/generate-image-handler.ts` | NEW |
| `landing/demo/apps/worker/src/index.ts` | Register `generate-image` queue + handlers |
| `landing/demo/apps/web/src/lib/api.ts` | Add `generations.createImage`, `generations.eventsUrl` |
| `landing/demo/apps/web/src/lib/sse.ts` | Add `useGenerationSSE` hook |
| `landing/demo/apps/web/src/routes/plugin.tsx` | Full rewrite: state, mutations, brand selector, variants grid, hero apply |
| `landing/demo/apps/web/src/features/plugin/plugin.css` | Layout + variants section + skeleton + textarea + error banner |
| `landing/demo/e2e/tests/plugin.spec.ts` | NEW — fixture-driven E2E |
| `landing/demo/scripts/smoke-plugin.sh` | NEW — curl integration smoke |
| `landing/demo/README.md` | Document `pnpm smoke:plugin` |

## Testing

### Manual smoke (dev)

1. `pnpm dev` (root) → 5173 web, 3001 api, worker running, S3/Redis/Postgres up.
2. Visit `/plugin` → brand pill shows first ready brand. Prompt prefilled. No variants visible.
3. Click Regenerate → button disabled, 3 skeleton tiles. Console shows SSE events.
4. ~6-12s later → 3 real OpenAI variants fill in (staggered).
5. Click variant 2 → coral border + badge, hero canvas updates.
6. Click variant 0 → swap. Hero updates.
7. Visit `/generations` → new row, type=image, status=done, output shows 3 keys.
8. Visit `/usage` → `image` feature row reflects $cost.

### Failure smoke

Unset `OPENAI_API_KEY` → click Regenerate → SSE `failed` event after retries → banner. Retry triggers fresh attempt. Generation row in DB has `status='failed' error='...'`.

### Playwright E2E (`demo/e2e/tests/plugin.spec.ts`)

Stubs API + SSE with deterministic fixtures (no real OpenAI). Assertions:
- Textarea editable, char counter updates.
- Regenerate disabled when prompt empty.
- After fixture-driven SSE plays out, grid renders 3 variants.
- Click variant updates hero `<img src>` and toggles `data-applied` attribute.
- No-brand state: textarea disabled, "Create a brand first" link visible.

Runs in CI alongside existing `visual.spec.ts`.

### curl integration smoke (`demo/scripts/smoke-plugin.sh`)

Hits real local backend (api+worker+redis+postgres+s3 must be up). Real OpenAI hit. Asserts:

```bash
# 1. POST returns 201 + id
GEN=$(curl -sS -X POST http://localhost:3001/api/generations/image \
  -H 'content-type: application/json' \
  -d "{\"prompt\":\"$PROMPT\",\"brandId\":\"$BRAND_ID\",\"layerName\":\"hero-image\"}" \
  | jq -r .id)

# 2. Poll until done (60s timeout)
deadline=$(( $(date +%s) + 60 ))
while :; do
  json=$(curl -sS "http://localhost:3001/api/generations/$GEN")
  status=$(echo "$json" | jq -r .status)
  [ "$status" = "done" ] && break
  [ "$status" = "failed" ] && { echo "failed"; exit 1; }
  [ $(date +%s) -ge $deadline ] && { echo "timeout"; exit 1; }
  sleep 2
done

# 3. Assert 3 variants
n=$(echo "$json" | jq '.output.variants | length')
[ "$n" = "3" ] || { echo "expected 3 variants got $n"; exit 1; }

# 4. Storage HEAD returns 200 image/png
KEY=$(echo "$json" | jq -r '.output.variants[0].s3Key')
curl -sSI "http://localhost:3001/api/_storage/$KEY" | grep -qi 'content-type: image/png'

# 5. Usage rollup contains image feature with non-zero cost
curl -sS "http://localhost:3001/api/usage?groupBy=feature&days=1" \
  | jq -e '.[] | select(.key == "image") | (.costUsd | tonumber > 0)'
```

Exposed as `pnpm smoke:plugin` in `demo/package.json`. Not in CI (costs $).

### Light unit tests

- `packages/ai/generate-image.test.ts` — mocks `experimental_generateImage`, asserts pricing math + return shape.
- `apps/api/routes/generation/router.test.ts` — POST validation: prompt empty / over 200 / unknown brand / brand profile not ready → expected status codes.
- `buildGroundedPrompt.test.ts` — snapshot: empty palette, full palette, missing `logo_usage`.

## Open questions / risks

- **`gpt-image-2` availability via `@ai-sdk/openai`:** `@ai-sdk/openai` may need version-pinned for `gpt-image-2`. If only `gpt-image-1` is exposed, fall back to it for the demo and update model string in pricing.ts. The architectural story holds.
- **OpenAI key in committed `.env`:** `.env` is `.gitignore`d (verify before merging). `.env.example` carries placeholder.
- **Concurrency:** 3 parallel calls to OpenAI per click. At demo scale (1 user), no rate-limit concern. Production posture is per-tenant caps via `packages/ai`, out of scope.
- **Orphaned S3 keys on retry:** if first attempt uploads variants then transient fails late, those keys stay. Acceptable for demo. Cleanup is a stretch-goal cron.
