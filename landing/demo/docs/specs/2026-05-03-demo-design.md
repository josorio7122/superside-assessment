# Studio Demo — Design Spec

**Date:** 2026-05-03
**Status:** Approved (brainstorming complete)
**Location:** `landing/demo/`

## 1. Goal

Build a runnable, end-to-end working slice of the Studio architecture-case deliverable inside `landing/demo/`. A reviewer can `pnpm setup && pnpm dev`, open the admin web, and watch a real Slack or Heineken brand-guideline PDF flow through the live extraction pipeline into a versioned, editable structured profile that visually matches the landing-page mockups.

The demo is not a product. It is a **fidelity proof** that the architecture in `docs/architecture.md` runs as designed and that the visual system in `landing/DESIGN.md` survives the jump from mockup to live React.

## 2. Scope

### Live (real path, real LLM, real persistence)
- Brand CRUD (list, create, rename, soft-delete) against Postgres
- Brand-guideline lifecycle: PDF upload → S3 → BullMQ job → OpenRouter GPT-5.5 multimodal extraction → structured `BrandProfile` jsonb → versioned, rollback-able
- Manual hand-author flow (no PDF)
- Manual edit flow (one save = one new version row)
- Re-upload flow (`is_current` stays on prior version until new extraction succeeds)
- Retry flow (failed → processing)
- Rollback flow (flag flip, no new row)
- SSE channel `/profiles/:id/events` for `ready` and `failed`
- Generations history list + detail (read-only, populated from seed)
- Usage dashboard (read-only, daily spend chart + per-user table from seed)

### Seeded only (no live behavior)
- Generations rows (~200 across 30 days, varied feature types and statuses)
- Usage_event rows (~500 linked to generations)
- Plugin tab (static screenshot of landing's `PluginMockup`, captioned "out of demo scope")

### Out of scope
- WorkOS SSO, RBAC enforcement, Organizations primitive
- OpenAI direct image generation, fal.ai, image-to-image
- PostHog observability, evals, session replay
- Multi-tenant onboarding
- ClickHouse, analytics rollups
- Plugin runtime (the figma plugin itself; demo only references seeded rows that mimic plugin-originating generations)
- CI/CD pipeline beyond Playwright e2e on PR

## 3. Architecture

### 3.1 Stack

| Layer | Pick |
|---|---|
| Runtime | Node 24 LTS, pnpm |
| Monorepo | Turborepo, file-based workspace |
| API | Hono 4, port 3001 |
| Worker | Standalone Node process, BullMQ consumer |
| DB | Postgres 17 + Drizzle ORM (latest via CLI) |
| Cache / queue / pubsub | Redis 7 (BullMQ + SSE bridge channel) |
| Object store | S3 via LocalStack (path-style endpoint, presigned URLs) |
| LLM gateway | OpenRouter (`@openrouter/ai-sdk-provider`, `response-healing` plugin) |
| LLM model (extraction) | `openai/gpt-5.5` — text + image + native PDF input, 1M context |
| AI SDK | Vercel AI SDK v6 (`ai` package), `generateObject` with Zod 4 schema on every call |
| Web | Vite 6 + React 19 + TanStack Router (file-based) + TanStack Query + TanStack Form + Tailwind 4 + shadcn/ui |
| Schemas | Zod 4 (shared via `packages/schemas`) |
| Logging | pino (api + worker), pino-pretty in dev |
| Tests | Playwright + `@axe-core/playwright` + visual regression (`toHaveScreenshot`) |
| Lint / format | Biome |

CLI-first installation: every package scaffolds via `pnpm dlx create-...` so the lockfile pins to whatever ships latest at scaffold time.

### 3.2 Repo layout

```
landing/demo/
├── apps/
│   ├── api/                      Hono server (routes, validators, services, repositories)
│   ├── worker/                   BullMQ consumer for extract-profile jobs
│   └── web/                      React + Vite admin web app
├── packages/
│   ├── db/                       Drizzle schema, migrations, seed scripts
│   ├── ai/                       OpenRouter client wrappers, prompts
│   ├── schemas/                  Zod schemas (BrandProfile, API DTOs, generation IO)
│   └── tokens/                   Shared CSS vars (OKLCH) bridged from landing/src/styles/global.css
├── infra/
│   ├── docker-compose.yml        postgres + redis + localstack
│   ├── localstack/init/          bucket creation script
│   └── seed-pdfs/                slack-2020.pdf, heineken.pdf (downloaded once)
├── e2e/                          Playwright suites + visual baselines
├── scripts/
│   ├── fetch-seed-pdfs.sh
│   ├── seed.ts
│   ├── capture-mockup-baselines.ts
│   └── smoke.sh
├── pnpm-workspace.yaml
├── turbo.json
├── biome.json
├── tsconfig.base.json
├── .env.example
├── .env                          (gitignored)
└── README.md
```

### 3.3 Component diagram

```
┌─────────────┐     HTTP       ┌──────────────────┐
│   Web       │───────────────▶│   API (Hono)     │
│ (Vite, 5173)│   SSE          │   :3001          │
└─────────────┘◀───────────────│                  │
                               │  - fake-auth mw  │
                               │  - per-entity    │
                               │  - SSE bridge    │
                               └────┬─────┬───────┘
                                    │     │
                            BullMQ  │     │ pub/sub
                            enqueue │     │ subscribe
                                    ▼     ▼
                               ┌─────────────┐
                               │   Redis 7   │◀────────────┐
                               └─────────────┘             │
                                    ▲                      │
                                    │ consume              │ publish
                                    │                      │
                               ┌────┴───────────────┐      │
                               │   Worker           │──────┘
                               │  (extract-profile) │
                               └────┬───────────────┘
                                    │
                  ┌─────────────────┼──────────────────┐
                  │                 │                  │
                  ▼                 ▼                  ▼
          ┌──────────────┐  ┌────────────────┐  ┌─────────────┐
          │  LocalStack  │  │  OpenRouter    │  │  Postgres   │
          │  S3          │  │  GPT-5.5       │  │  (Drizzle)  │
          │  (PDFs)      │  │  multimodal    │  │             │
          └──────────────┘  └────────────────┘  └─────────────┘
```

`-->` denotes synchronous calls; pub/sub is denoted in labels.

## 4. Data model

Drizzle schema in `packages/db/schema.ts`. Six tables, simplifications for demo noted inline.

```
org              id (uuid pk), name, created_at
                 (1 seed row, no workos_org_id since no auth)

user             id, org_id, email, name, role, created_at
                 (5 seed rows; role mirrored from spec but never gates)

brand            id, org_id, name, deleted_at, created_at
                 (Slack, Heineken; deleted_at nullable, no restore)

brand_profile    id, org_id, brand_id, version (int),
                 profile (jsonb, nullable),
                 source_pdf_s3_key, source_pdf_filename, source_pdf_size_bytes (nullable),
                 status (enum: 'processing'|'ready'|'failed'),
                 ingest_error (text, nullable),
                 is_current (bool),
                 created_by (fk -> user),
                 created_at

generation       id, org_id, brand_id, user_id,
                 type (enum: 'copy_variant'|'translate'|'image'),
                 status (enum: 'pending'|'running'|'done'|'failed'),
                 input (jsonb), output (jsonb, nullable), error (nullable),
                 figma_file_key, figma_node_id (nullable),
                 started_at, completed_at, created_at

usage_event      id, org_id, brand_id, user_id, generation_id (nullable for extract events),
                 feature (enum: 'copy_variant'|'translate'|'image'|'extract'),
                 provider (text), model (text),
                 input_tokens, output_tokens (nullable),
                 cost_usd (numeric), latency_ms (int),
                 created_at
```

### 4.1 Indexes

```sql
create index on "user" (org_id);
create index on brand (org_id);
create index on brand_profile (org_id);
create index on generation (org_id);
create index on usage_event (org_id);

create index on brand_profile (org_id, brand_id, version desc);
create unique index on brand_profile (brand_id) where is_current = true;
create index on brand_profile (org_id, status) where status in ('processing','failed');

create index on generation (org_id, user_id, created_at desc);
create index on generation (org_id, status) where status in ('pending','running');
create unique index on generation (org_id, figma_file_key, figma_node_id)
  where type = 'image' and status in ('pending','running');

create index on usage_event (org_id, created_at desc);
create index on usage_event (org_id, user_id, created_at desc);
create index on usage_event (org_id, brand_id, created_at desc);
```

### 4.2 BrandProfile jsonb shape (Zod 4)

```ts
// packages/schemas/brand-profile.ts
export const BrandProfileSchema = z.object({
  brand_name: z.string(),
  voice: z.object({
    tone_descriptors: z.array(z.string()).max(8),
    voice_principles: z.array(z.string()),
    do: z.array(z.string()),
    dont: z.array(z.string()),
  }),
  visual: z.object({
    palette: z.array(z.object({
      name: z.string(),
      hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      role: z.enum(['primary','secondary','accent','neutral']).optional(),
    })),
    typography: z.object({
      display: z.string().nullable(),
      body: z.string().nullable(),
      mono: z.string().nullable(),
    }).optional(),
    logo_usage: z.array(z.string()).optional(),
  }),
  localization: z.object({
    locales: z.array(z.string()),
    notes: z.string().nullable(),
  }).optional(),
  banned_terms: z.array(z.string()),
});
export type BrandProfile = z.infer<typeof BrandProfileSchema>;
```

The same schema is the AI SDK output schema, the API request validator (on edit), and the Drizzle column TS type.

## 5. API surface

All routes Hono-registered, JSON responses, fake-auth middleware injects seed `org_id` and `user_id` on every request.

```
GET    /healthz                          200 ok
GET    /me                                seeded user/org

GET    /brands                            list (deleted_at IS NULL)
POST   /brands                            { name } -> { id, ... }
GET    /brands/:brandId                   detail (joins current profile)
PATCH  /brands/:brandId                   { name?, deleted_at? }

GET    /brands/:brandId/profiles          version list (desc)
POST   /brands/:brandId/profiles          multipart (file=*.pdf) OR JSON ({}) -> hand-author
                                           returns { profileId, status }

GET    /profiles/:profileId               full row including jsonb
PUT    /profiles/:profileId               { profile: BrandProfile } -> creates new version row,
                                           flips is_current
POST   /profiles/:profileId/retry         processing-or-failed -> processing, re-enqueue
POST   /profiles/:profileId/set-current   ready row -> is_current=true (rollback)
GET    /profiles/:profileId/events        SSE: ready | failed

GET    /generations                       ?brandId&type&status&userId&limit&cursor
GET    /generations/:generationId         detail

GET    /usage                             ?groupBy=user|brand|day&days=30
                                           returns aggregated rollup
```

### 5.1 Validation + errors

- All bodies validated via Zod (request DTOs in `packages/schemas/api`)
- Repositories return `Result<T, RepoError>` (hand-rolled discriminated union)
- Routers map errors: `RepoError.NotFound` → 404, `RepoError.Conflict` → 409, `RepoError.Validation` → 400, anything else → 500 with requestId in body
- No try/catch outside repository layer; routers always unwrap to HTTP

### 5.2 SSE bridge

```ts
// /profiles/:profileId/events
// 1. open response, set headers, flush
// 2. subscribe to redis 'profile:events'
// 3. on message JSON.parse, filter where profileId matches
// 4. write `event: ready\ndata: {...}\n\n`
// 5. on client disconnect, unsubscribe + close
```

Heartbeat every 25s (`: keepalive\n\n`).

## 6. Worker

`apps/worker/src/index.ts` — single BullMQ Worker bound to the `extract-profile` queue.

```
Job payload: { profileId: string, s3Key: string }
Concurrency: 2
Attempts: 3
Backoff: { type: 'exponential', delay: 1000 }
```

Steps:
1. Load profile row by id; bail if not in `processing`.
2. `s3.getObject(s3Key)` → Buffer.
3. `packages/ai.extractBrandProfile(buffer)` (see §7).
4. On success, in a single Drizzle transaction:
   ```sql
   UPDATE brand_profile SET profile=$1, status='ready', ingest_error=null WHERE id=$2;
   UPDATE brand_profile SET is_current=false WHERE brand_id=$3 AND is_current=true AND id<>$2;
   UPDATE brand_profile SET is_current=true WHERE id=$2;
   INSERT INTO usage_event (...) VALUES (...);
   ```
5. `redis.publish('profile:events', JSON.stringify({ profileId, event: 'ready' }))`.
6. On failure after retries: `status='failed'`, `ingest_error = err.message`; publish `failed`.

Worker logs every step with `requestId` propagated from the originating API call (stashed in the job payload).

## 7. LLM layer (`packages/ai`)

Every LLM call goes through this package. There is no LLM call site outside it.

```ts
// packages/ai/openrouter.ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { BrandProfileSchema } from '@studio/schemas';

const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

export const extractionModel = openrouter('openai/gpt-5.5', {
  plugins: [{ id: 'response-healing' }],
});

export async function extractBrandProfile(pdf: Buffer) {
  const { object, usage } = await generateObject({
    model: extractionModel,
    schema: BrandProfileSchema,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: EXTRACT_PROMPT },
        { type: 'file', data: pdf, mediaType: 'application/pdf' },
      ],
    }],
  });
  return { profile: object, usage };
}
```

Every call returns `{ object, usage }`; the worker writes a `usage_event` row from `usage` (input_tokens, output_tokens, cost computed via per-1k-token pricing constants in `packages/ai/pricing.ts`, latency captured by wall-clock around the call).

`response-healing` plugin repairs malformed JSON (markdown fences, trailing commas) before Zod validation.

### 7.1 Extraction prompt

`packages/ai/prompts/extract-brand-profile.ts`:

> Extract the brand identity from this brand-guideline PDF as structured JSON.
>
> Required: brand name, tone descriptors (max 8 single-word adjectives), voice principles (concise sentences from the guideline), explicit do and don't lists, visual palette (named colors with hex), typography (display, body, mono fonts if present), supported locales (ISO codes if listed), banned terms (verbatim).
>
> If a field is absent in the PDF, leave it empty rather than inventing.

## 8. Web app

### 8.1 Token bridge

`packages/tokens/global.css` is the single source of truth for OKLCH variables. It is imported by both the Astro landing (`src/styles/global.css` re-exports) and the React admin web (`apps/web/src/main.tsx` imports). Variable list:

```
--color-cream, --color-charcoal, --color-reading, --color-stone,
--color-coral, --color-hairline,
--font-serif, --font-sans, --font-mono,
--ease-out-quart, --ease-out-quint
```

shadcn primitives are themed via these vars in `tailwind.config.ts` so `Button`, `Card`, etc. inherit the cream/charcoal axis automatically.

### 8.2 Routes (TanStack Router file-based)

```
apps/web/src/routes/
├── __root.tsx                  Shell (top bar + left rail)
├── index.tsx                   redirect -> /brands
├── brands.index.tsx            BrandsPage  (list)
├── brands.$brandId.tsx         BrandDetailPage (Voice/Visual/Localization/Banned tabs)
├── generations.index.tsx       HistoryPage (table + filters)
├── generations.$id.tsx         GenerationDetailDrawer
├── usage.tsx                   UsagePage (chart + table)
└── plugin.tsx                  PluginPlaceholder (static, captioned)
```

### 8.3 Page → mockup parity

| Page | Source mockup | Dynamic behavior |
|---|---|---|
| BrandsPage | `BrandsMockup.astro` | useQuery `['brands']`. Cards: name, status badge, gen-count (30d), last-activity. New brand dialog. |
| BrandDetailPage | `GuidelineMockup.astro` | 4 tabs. TanStack Form tracks dirty edits; Save → mutation creates new version row. SSE on rows where `status=processing`. Sidebar: source PDF card (file name, size, signed-URL link), palette card (live), version timeline (rollback CTA per row). |
| HistoryPage | `HistoryMockup.astro` | Table reads seeded `generation`. Filters: brand, type, status, user, date range. Detail drawer overlay route. SSE wiring present (no live rows in seed). |
| UsagePage | `UsageMockup.astro` | Recharts daily-spend area chart + per-user table from `/usage?groupBy=user`. Date-range selector (7d / 30d). |
| PluginPlaceholder | `PluginMockup.astro` | Static iframe-styled card with caption "Designer surface — Figma plugin (out of demo scope; the platform writes plugin-originating rows to `generation` and `usage_event`, visible in History and Usage)." |

### 8.4 Component reuse

shadcn primitives: `Button`, `Card`, `Tabs`, `Input`, `Label`, `Dialog`, `Sheet`, `DropdownMenu`, `Toast`, `Skeleton`, `Table`, `Select`. Re-themed via CSS vars. shadcn slate defaults overridden so neutral grays become tinted cream.

### 8.5 SSE client

```ts
function useProfileEvents(profileId: string, onReady: () => void, onFailed: (msg: string) => void) {
  useEffect(() => {
    const es = new EventSource(`/api/profiles/${profileId}/events`);
    es.addEventListener('ready', () => onReady());
    es.addEventListener('failed', (e) => onFailed(JSON.parse(e.data).error));
    return () => es.close();
  }, [profileId]);
}
```

### 8.6 Error UX

- TanStack Query default `onError` → shadcn toast.
- 5xx renders inline retry banner above the affected card.
- `prefers-reduced-motion` honoured (no fade-ins, opacity-only on SSE state changes).
- Visible focus rings (3px coral at 35% opacity, per landing).

## 9. Seed data (`scripts/seed.ts`)

Idempotent. `pnpm db:seed` truncates and reseeds; uses cached extraction JSON when present so the seed does not require live OpenRouter calls every time.

- 1 `org`: "DesignTechCo"
- 5 `user` rows: jo (admin), maya (brand_manager), alex (brand_manager), sam (designer), kai (designer)
- 2 `brand` rows: Slack, Heineken
- 6 `brand_profile` rows total (3 per brand):
  - **v1** (created 26 days ago) — real PDF extraction. Worker invoked at seed time if no cached extraction JSON exists at `infra/seed-extractions/<brand>.json`. After first successful run, cache is written.
  - **v2** (created 11 days ago) — re-extraction (same PDF; simulates re-upload).
  - **v3** (created 2 days ago, `is_current=true`) — manual edit on top of v2 (e.g., one tone descriptor edited).
- ~200 `generation` rows: spread across last 30 days, mix of `copy_variant` (50%) / `translate` (35%) / `image` (15%); 90% `done`, 5% `failed`, 5% `pending`/`running` for visual variety; varied users, brands, durations 800–9000ms; plausible figma_file_key and figma_node_id strings.
- ~500 `usage_event` rows: linked to generations + extractions. Costs: $0.001–$0.04 per row. Models: `openai/gpt-5.5` (text), `openai/gpt-image-2` (image), `openai/gpt-5.5` (extract).

PDFs downloaded once via `scripts/fetch-seed-pdfs.sh`:
```
infra/seed-pdfs/slack-2020.pdf
infra/seed-pdfs/heineken.pdf
```

## 10. Testing

`e2e/` Playwright project; CI runs all suites against `docker-compose up -d`.

### 10.1 Suites

1. **smoke.spec.ts** — golden path: open `/brands`, click Slack, see ready profile, edit a tone chip, save, version count increments, rollback to v3, original chip back.
2. **brand-guideline-extraction.spec.ts** — POST PDF (Slack-2020) via API client → poll until `status=ready` (timeout 120s) → assert `BrandProfileSchema.parse(profile)` succeeds → assert palette has ≥3 swatches → tone_descriptors non-empty → banned_terms non-empty.
3. **sse.spec.ts** — upload PDF via UI → assert UI updates without manual reload within 120s of `ready` event.
4. **failure-retry.spec.ts** — set worker env `FORCE_EXTRACT_FAIL=1` for first attempt → upload → assert `failed` state surfaces → click Retry → unset → success.
5. **visual.spec.ts** — `toHaveScreenshot()` per page (Brands, BrandDetail, History, Usage, Plugin) compared against landing-mockup baselines captured by `scripts/capture-mockup-baselines.ts` at fixed viewport (1440×900). Threshold: `maxDiffPixelRatio: 0.02`.
6. **a11y.spec.ts** — `@axe-core/playwright` on every route, fail on `serious` and `critical` violations.
7. **smoke.sh** — curl every endpoint with jq assertions on response shape.

### 10.2 Visual baseline capture

`scripts/capture-mockup-baselines.ts` boots the landing dev server, navigates to each `#solution-<id>` hash, screenshots the active mockup panel at 1440×900, writes to `e2e/baselines/<page>.png`. Re-run on intentional design changes.

## 11. Dev / Run

### 11.1 .env (`demo/.env`)

```
OPENROUTER_API_KEY=sk-or-...
DATABASE_URL=postgres://demo:demo@localhost:5432/studio_demo
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:4566
S3_REGION=us-east-1
S3_BUCKET=studio-demo
S3_ACCESS_KEY=test
S3_SECRET_KEY=test
API_PORT=3001
WEB_PORT=5173
LOG_LEVEL=info
NODE_ENV=development
```

`.env.example` checked in with placeholder values.

### 11.2 docker-compose.yml

- `postgres:17-alpine` — port 5432, healthcheck `pg_isready`
- `redis:7-alpine` — port 6379, healthcheck `redis-cli ping`
- `localstack/localstack:latest` — port 4566, `SERVICES=s3`, healthcheck on `/_localstack/health`
- LocalStack init script creates the `studio-demo` bucket on startup

### 11.3 Bootstrap commands

```
cd landing/demo
pnpm install
pnpm setup        # docker-compose up -d, wait health, drizzle migrate, seed (real extraction first run)
pnpm dev          # turbo runs api + worker + web concurrently
```

### 11.4 Component scripts

```
pnpm db:migrate
pnpm db:seed
pnpm db:reset
pnpm test:e2e
pnpm test:visual
pnpm test:a11y
pnpm test:smoke
pnpm typecheck
pnpm lint
```

## 12. Risks + mitigations

| Risk | Mitigation |
|---|---|
| GPT-5.5 returns wrong palette colors or hallucinates fields | Response-healing plugin + Zod runtime validation; failures surface as `status=failed`; user can manually edit |
| First extraction slow (multimodal PDF can take 30–60s) | SSE keeps UI live; loading skeleton matches mockup tone; worker concurrency=2 so two brands seed in parallel |
| LocalStack S3 quirks (presigned URL host mismatch in browser) | Use path-style endpoint, override presigned host to `http://localhost:4566` for browser fetches |
| Visual regression false positives across machines | Pin font versions in repo, run baselines inside Playwright docker image, `maxDiffPixelRatio: 0.02` |
| OpenRouter quota or outage during demo run | Cache real extractions as JSON fixtures alongside PDFs; seed script uses cache when present |
| Drizzle migration drift between dev and CI | `drizzle-kit migrate` runs as part of `pnpm setup` and CI; no `push` |
| Long bootstrap on first run | `pnpm setup` shows step progress; cached extractions cut second-run time to <10s |

## 13. Open items (deferred, tracked here)

- Per-field extraction confidence flags (open in spec; not designed)
- Diff view between profile versions (desirable, not required)
- Optimistic locking on concurrent edits (last-save-wins acknowledged)
- Rate limiting (out of demo scope)

## 14. Acceptance criteria

The demo passes when:
1. `pnpm setup && pnpm dev` from a clean clone results in a running web app at http://localhost:5173 with seeded data.
2. Uploading `infra/seed-pdfs/slack-2020.pdf` to a fresh brand produces a `ready` profile within 120s with non-empty tone descriptors, ≥3 palette swatches, and Zod-valid jsonb.
3. Same for `heineken.pdf`.
4. Manual edit on a ready profile creates a new version row, flips `is_current`, and the prior current row is preserved.
5. Rollback flips `is_current` without inserting a new row.
6. All Playwright suites pass in CI.
7. All visual regression diffs are ≤2% pixel ratio.
8. axe-core reports zero `serious` or `critical` violations on every route.

## 15. Out of scope (locked, do not expand mid-build)

WorkOS SSO. RBAC enforcement. OpenAI direct image generation. fal.ai. PostHog. Multi-tenant onboarding. ClickHouse. Plugin runtime. Per-tenant rate limits. Spend caps. Eval pipeline. Streaming text. CDN in front of S3.

These are documented in the parent `docs/architecture.md` and stay there. The demo proves the live brand-guideline path, the visual fidelity, and the architectural shape — nothing more.
