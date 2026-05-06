# Studio demo

Runnable end-to-end slice of the Studio platform — brand-guideline PDF →
OpenRouter GPT-5.5 multimodal extraction → versioned, editable structured
profile, with seeded generations + usage analytics.

This is the working code that backs the architecture proposal. It exercises
every load-bearing seam: API ↔ worker ↔ Postgres/Redis ↔ OpenRouter, plus a
Vite/React 19 web app, BullMQ-driven extraction, SSE progress, optimistic
profile editing with versioning, and a full Playwright + axe-core test layer.

---

## Quick start

### Option 1 — Docker compose (zero-deps)

Everything (postgres, redis, ministack, api, worker, web) runs in containers.
You only need Docker.

```bash
cp .env.example .env          # paste OPENROUTER_API_KEY + OPENAI_API_KEY
pnpm docker:up                # build + start all services (first run ~3 min)
```

Open <http://localhost:5173>. Stop with `Ctrl+C`, tear down with `pnpm docker:down`.

Logs: `pnpm docker:logs`. Migrations + seed run automatically on first boot.

### Option 2 — Local node (faster iteration)

You need Node 24 (`.nvmrc` pins it), pnpm, and a running Postgres + Redis
(see [Infrastructure](#infrastructure)).

```bash
pnpm install
cp .env.example .env          # paste OPENROUTER_API_KEY + OPENAI_API_KEY
pnpm infra:up                 # postgres + redis + ministack only
pnpm db:migrate
pnpm db:seed                  # creates org/users/brands + ~200 gens + ~264 usage rows
pnpm dev                      # api :3001, web :5173, worker (no port)
```

Open <http://localhost:5173>.

The seed step reads `infra/seed-extractions/{slack,heineken}.json` if present
(committed-out by `.gitignore`, materialised the first time you run it). On a
fresh clone with no cache, `pnpm fetch:pdfs` downloads the source PDFs and
the seed will then call OpenRouter once per brand to extract them, caching
the result.

---

## Infrastructure

The canonical spec assumes `docker compose` provides Postgres 17, Redis 7,
and LocalStack S3 (see `infra/docker-compose.yml`, with port mappings
`5433` / `6380` / `4566`). On this machine docker pulls of `postgres:17`,
`redis:7`, and `localstack/localstack` are blocked, so the demo defaults to:

- **Postgres**: existing `pgvector/pgvector:pg16` container
  (`dish-decomposition-cache-postgres-1`) on `localhost:5432`, db `studio_demo`,
  user `demo` / password `demo`
- **Redis**: existing `redis:5` container (`local-dev-cache-1`) on
  `localhost:6379`
- **Object storage**: `STORAGE_MODE=local` writes uploaded PDFs to
  `./.local-storage/`; the storage adapter at `apps/api/src/infra/storage.ts`
  switches between local fs and S3 transparently

These choices are wired via `.env` (committed as `.env.example`). To flip back
to the docker-compose stack when pulls are unblocked:

1. Update `.env`:
   ```
   DATABASE_URL=postgres://demo:demo@localhost:5433/studio_demo
   REDIS_URL=redis://localhost:6380
   STORAGE_MODE=s3
   ```
2. Bring up infra and re-run migrations:
   ```bash
   pnpm infra:up
   pnpm infra:wait
   pnpm db:migrate
   pnpm db:seed
   ```

Schema, code, and tests are unchanged across the two infra modes — only
ports + storage adapter differ.

---

## What's live

- **Brand CRUD** — `/brands` lists; `New brand` dialog creates
- **Upload + extract** — drop a PDF on a brand; the API enqueues a BullMQ job;
  worker fetches via OpenRouter (`openai/gpt-5.5`, multimodal); progress
  streams over SSE to the browser
- **Manual edit** — every save (`PATCH /api/profiles/:id`) creates a new
  `brand_profile` row with `version + 1`, marks it `isCurrent`, and demotes
  the prior current version
- **Retry** — failed extractions surface a "Retry" affordance that re-enqueues
- **Rollback** — version timeline; selecting an older version flips
  `isCurrent` (no destructive write)
- **Generations history** — `/generations` table with filters, drawer on row
  click
- **Usage dashboard** — `/usage` with by-day, by-user, by-brand, by-feature
  breakdowns

---

## What's seeded

`pnpm db:seed` produces a deterministic-but-jittered demo dataset:

| Table             | Rows  | Notes                                                          |
| ----------------- | ----- | -------------------------------------------------------------- |
| `org`             | 1     | DesignTechCo                                                   |
| `user`            | 5     | 1 admin, 2 brand managers, 2 designers                         |
| `brand`           | 2     | Slack, Heineken                                                |
| `brand_profile`   | 6     | 3 versions per brand (v3 = current, v2/v1 historical)          |
| `generation`      | ~200  | Mix of `copy_variant`, `translate`, `image`; ~10% failed       |
| `usage_event`     | ~264  | One row per LLM call, with provider/model/tokens/cost/latency  |

The two extracted brand profiles (`infra/seed-extractions/slack.json` /
`heineken.json`) are real OpenRouter outputs cached on first run.

---

## Architecture

```
       ┌────────────────────────────────────────────────────────────────┐
       │                         Browser                                │
       │   Vite / React 19 / TanStack Router+Query+Form / Tailwind 4    │
       └───────────┬───────────────────────────────────┬────────────────┘
                   │  REST + SSE (Vite proxy)          │
                   ▼                                   ▼
       ┌────────────────────────────┐      ┌─────────────────────────┐
       │   @studio/api (Hono 4)     │      │   @studio/worker        │
       │   :3001                    │      │   BullMQ consumer       │
       │   • REST routes            │      │   • extract-profile-job │
       │   • Zod validation         │      │   • OpenRouter call     │
       │   • SSE progress channel   │      │   • DB write + SSE pub  │
       └────┬──────────┬────────────┘      └────┬────────────┬───────┘
            │          │                        │            │
            ▼          ▼                        ▼            ▼
       ┌─────────┐  ┌─────────┐            ┌──────────┐ ┌────────────┐
       │Postgres │  │ Redis   │◄───────────│ Postgres │ │ OpenRouter │
       │ Drizzle │  │ BullMQ  │            │  Drizzle │ │ AI SDK 6   │
       │ :5432   │  │ pub/sub │            │  + queue │ │ gpt-5.5    │
       └─────────┘  └─────────┘            └──────────┘ └────────────┘
```

PDF bytes flow through `apps/api/src/infra/storage.ts` (local fs in this
config; S3 in compose mode). The worker re-reads the bytes from storage
before calling OpenRouter, so the API process never holds them.

---

## Test commands

```bash
# Hermetic suite: smoke + visual + a11y, no LLM, no worker required
pnpm test:e2e

# Visual snapshots only (writes diffs to playwright-report on drift)
pnpm test:visual

# axe-core accessibility (5 routes, fails on serious/critical violations)
pnpm test:a11y

# curl every API endpoint (14 routes), fail-fast on non-200 or schema mismatch
pnpm test:smoke

# Plugin smoke test — end-to-end against running stack (consumes OpenAI tokens ~$0.12/run)
pnpm smoke:plugin

# Live extraction against OpenRouter (consumes tokens — opt-in only).
# Requires the worker to be running on the side: `pnpm --filter @studio/worker dev`.
RUN_LIVE=1 pnpm test:e2e

# Failure-retry: requires a worker started with FORCE_EXTRACT_FAIL=1
# Terminal A:  FORCE_EXTRACT_FAIL=1 pnpm --filter @studio/worker dev
# Terminal B:  FORCE_EXTRACT_FAIL=1 RUN_LIVE=1 pnpm --filter @studio/e2e test failure-retry
```

Visual snapshots live in `e2e/tests/visual.spec.ts-snapshots/` (committed,
asserted) and `e2e/baselines/` (landing-app mockups, human comparison only).
Update with `pnpm --filter @studio/e2e test visual -- --update-snapshots`.

### Plugin smoke test

End-to-end smoke against a running stack (api + worker + redis + postgres + s3 + at least one brand with a `ready` profile). Hits real OpenAI — costs ~$0.12/run.

```bash
pnpm dev   # in another terminal
pnpm smoke:plugin
```

Override prompt or API URL with env vars:

```bash
PROMPT="warm autumn forest" pnpm smoke:plugin
API=http://staging.example.com pnpm smoke:plugin
```

---

## Repo layout

```
demo/
├── apps/
│   ├── api/         Hono 4 REST + SSE server (:3001)
│   ├── web/         Vite 6 + React 19 + TanStack stack (:5173)
│   └── worker/      BullMQ consumer for extract-profile jobs
├── packages/
│   ├── ai/          OpenRouter (AI SDK 6) wrapper + prompts
│   ├── db/          Drizzle schema + migrations + client
│   ├── schemas/     Zod 4 contracts shared across api/worker/web
│   └── tokens/      Tailwind/CSS design tokens (single global.css)
├── infra/
│   ├── docker-compose.yml   pg17 + redis7 + LocalStack (alt path; see above)
│   ├── seed-pdfs/           Fetched by `pnpm fetch:pdfs` (gitignored)
│   ├── seed-extractions/    Cached OpenRouter outputs (gitignored)
│   └── localstack/          S3 bucket init script
├── e2e/                     Playwright workspace: smoke / extraction / visual / a11y
├── scripts/
│   ├── seed.ts              Generates org/users/brands/generations/usage
│   ├── smoke.sh             curl smoke for every API route
│   ├── fetch-seed-pdfs.sh   Pulls Slack 2020 + Heineken brand PDFs
│   ├── wait-for-infra.mjs   Polls pg/redis/localstack readiness
│   └── capture-mockup-baselines.ts   Snapshots landing mockups for reference
└── docs/
    ├── specs/2026-05-03-demo-design.md         Canonical demo design
    └── plans/2026-05-03-demo-implementation.md Phased build plan (executed)
```

---

## Stack

- **Runtime**: Node 24 LTS, pnpm 10, Turborepo 2
- **API**: Hono 4 + `@hono/node-server`, BullMQ 5 on Redis, Drizzle 0.36 on
  Postgres, Zod 4 validation via `@hono/zod-validator`, pino logging,
  AWS SDK v3 S3 client (with local fs fallback)
- **Worker**: BullMQ 5 consumer, AI SDK 6 + `@openrouter/ai-sdk-provider` 2.x
  targeting `openai/gpt-5.5` (multimodal: text + PDF input)
- **Web**: Vite 6, React 19, TanStack Router/Query/Form, Tailwind 4 with
  `@tailwindcss/vite`, shadcn primitives over Radix UI, Recharts, Lucide
- **Schemas**: Zod 4 single-source-of-truth in `packages/schemas`
- **Tests**: Playwright 1.59 + `@axe-core/playwright` 4.11; bash + `jq`
  for the curl smoke

---

## Reference docs

- Design spec: [`docs/specs/2026-05-03-demo-design.md`](docs/specs/2026-05-03-demo-design.md)
- Implementation plan (executed in 5 phases):
  [`docs/plans/2026-05-03-demo-implementation.md`](docs/plans/2026-05-03-demo-implementation.md)
- E2E suite usage: [`e2e/README.md`](e2e/README.md)
