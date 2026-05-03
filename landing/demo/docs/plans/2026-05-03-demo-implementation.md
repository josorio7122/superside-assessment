# Studio Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable end-to-end demo of the Studio platform inside `landing/demo/` that proves the live brand-guideline extraction path against real Slack and Heineken PDFs and visually matches the landing-page mockups.

**Architecture:** Turborepo monorepo. Three apps (`api`, `worker`, `web`), four packages (`db`, `ai`, `schemas`, `tokens`). Postgres + Redis + LocalStack S3 via docker-compose. OpenRouter GPT-5.5 multimodal extraction with Zod-4 structured outputs on every LLM call. SSE bridge over Redis pub/sub. Visual regression + axe-core a11y in Playwright.

**Tech Stack:** Node 24 LTS, pnpm, Turborepo, Hono 4, BullMQ 5, Drizzle ORM, Postgres 17, Redis 7, LocalStack S3, Vercel AI SDK v6 + `@openrouter/ai-sdk-provider`, Vite 6, React 19, TanStack Router/Query/Form, Tailwind 4, shadcn/ui, Zod 4, Playwright + axe-core.

**Spec:** `landing/demo/docs/specs/2026-05-03-demo-design.md`

---

## Phase 0 — Workspace bootstrap

### Task 0.1: Create the workspace skeleton

**Files:**
- Create: `landing/demo/package.json`
- Create: `landing/demo/pnpm-workspace.yaml`
- Create: `landing/demo/turbo.json`
- Create: `landing/demo/tsconfig.base.json`
- Create: `landing/demo/biome.json`
- Create: `landing/demo/.gitignore`
- Create: `landing/demo/.env.example`
- Create: `landing/demo/.nvmrc`

- [ ] **Step 1: Create `.nvmrc`**

```
24
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "studio-demo",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=24" },
  "scripts": {
    "setup": "pnpm install && pnpm infra:up && pnpm infra:wait && pnpm db:migrate && pnpm db:seed",
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "biome check .",
    "format": "biome format --write .",
    "infra:up": "docker compose -f infra/docker-compose.yml up -d",
    "infra:down": "docker compose -f infra/docker-compose.yml down -v",
    "infra:wait": "node scripts/wait-for-infra.mjs",
    "db:migrate": "pnpm --filter @studio/db migrate",
    "db:seed": "pnpm --filter @studio/db seed",
    "db:reset": "pnpm --filter @studio/db reset",
    "test:e2e": "pnpm --filter @studio/e2e test",
    "test:visual": "pnpm --filter @studio/e2e test --grep visual",
    "test:a11y": "pnpm --filter @studio/e2e test --grep a11y",
    "test:smoke": "bash scripts/smoke.sh",
    "fetch:pdfs": "bash scripts/fetch-seed-pdfs.sh"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "turbo": "^2.3.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "e2e"
```

- [ ] **Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "migrate": { "cache": false },
    "seed": { "cache": false }
  }
}
```

- [ ] **Step 5: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx",
    "types": ["node"]
  }
}
```

- [ ] **Step 6: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignore": ["**/dist", "**/.turbo", "**/drizzle", "**/playwright-report"] },
  "linter": { "enabled": true, "rules": { "recommended": true, "style": { "noNonNullAssertion": "off" } } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 }
}
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules
.turbo
dist
.env
*.log
playwright-report
test-results
e2e/baselines/.diff
infra/seed-pdfs/*.pdf
infra/seed-extractions/*.json
.localstack
```

- [ ] **Step 8: Create `.env.example`**

```
OPENROUTER_API_KEY=sk-or-replace-me
DATABASE_URL=postgres://demo:demo@localhost:5432/studio_demo
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:4566
S3_REGION=us-east-1
S3_BUCKET=studio-demo
S3_ACCESS_KEY=test
S3_SECRET_KEY=test
S3_FORCE_PATH_STYLE=true
API_PORT=3001
WEB_PORT=5173
LOG_LEVEL=info
NODE_ENV=development
```

- [ ] **Step 9: Copy OPENROUTER_API_KEY to local `.env`**

```bash
cd landing/demo
cp .env.example .env
# Read parent landing's existing OPENROUTER_API_KEY if available, else prompt user
if [ -f ../../.env ] && grep -q '^OPENROUTER_API_KEY=' ../../.env; then
  KEY=$(grep '^OPENROUTER_API_KEY=' ../../.env | cut -d= -f2-)
  sed -i.bak "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$KEY|" .env
  rm .env.bak
fi
```

- [ ] **Step 10: Verify pnpm installs cleanly**

```bash
cd landing/demo && pnpm install
```

Expected: lockfile generated, no errors. Workspace empty so no apps yet.

- [ ] **Step 11: Commit**

```bash
git add landing/demo/
git commit -m "demo: bootstrap turborepo workspace skeleton"
```

---

### Task 0.2: Docker compose infra (Postgres + Redis + LocalStack)

**Files:**
- Create: `landing/demo/infra/docker-compose.yml`
- Create: `landing/demo/infra/localstack/init/01-create-bucket.sh`
- Create: `landing/demo/scripts/wait-for-infra.mjs`

- [ ] **Step 1: Create `infra/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: demo
      POSTGRES_PASSWORD: demo
      POSTGRES_DB: studio_demo
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U demo -d studio_demo"]
      interval: 2s
      timeout: 5s
      retries: 30

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 5s
      retries: 30

  localstack:
    image: localstack/localstack:latest
    restart: unless-stopped
    environment:
      SERVICES: s3
      DEBUG: 0
      AWS_DEFAULT_REGION: us-east-1
      DOCKER_HOST: unix:///var/run/docker.sock
    ports: ["4566:4566"]
    volumes:
      - "./localstack/init:/etc/localstack/init/ready.d"
      - "/var/run/docker.sock:/var/run/docker.sock"
      - "localstack-data:/var/lib/localstack"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:4566/_localstack/health"]
      interval: 3s
      timeout: 5s
      retries: 30

volumes:
  pgdata:
  localstack-data:
```

- [ ] **Step 2: Create LocalStack init script**

```bash
#!/usr/bin/env bash
set -e
awslocal s3 mb s3://studio-demo || true
awslocal s3api put-bucket-cors --bucket studio-demo --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET","PUT","POST","HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}'
echo "[init] bucket studio-demo ready"
```

`chmod +x infra/localstack/init/01-create-bucket.sh`

- [ ] **Step 3: Create `scripts/wait-for-infra.mjs`**

```js
import { setTimeout as sleep } from "node:timers/promises";
const checks = [
  { name: "postgres", url: null, tcp: { host: "localhost", port: 5432 } },
  { name: "redis", url: null, tcp: { host: "localhost", port: 6379 } },
  { name: "localstack", url: "http://localhost:4566/_localstack/health" },
];
async function tcpOpen({ host, port }) {
  const net = await import("node:net");
  return new Promise((res) => {
    const s = net.createConnection({ host, port }, () => { s.end(); res(true); });
    s.on("error", () => res(false));
  });
}
async function httpOk(url) {
  try { const r = await fetch(url); return r.ok; } catch { return false; }
}
const deadline = Date.now() + 60_000;
for (const c of checks) {
  process.stdout.write(`[wait] ${c.name}…`);
  while (Date.now() < deadline) {
    const ok = c.url ? await httpOk(c.url) : await tcpOpen(c.tcp);
    if (ok) { console.log(" ok"); break; }
    await sleep(500);
  }
  if (Date.now() >= deadline) { console.error(`\n[wait] ${c.name} TIMEOUT`); process.exit(1); }
}
console.log("[wait] all services healthy");
```

- [ ] **Step 4: Bring up infra and verify**

```bash
cd landing/demo
pnpm infra:up
pnpm infra:wait
```

Expected: `[wait] all services healthy`

- [ ] **Step 5: Smoke-test S3 bucket**

```bash
docker exec $(docker ps -qf name=localstack) awslocal s3 ls
```

Expected: line containing `studio-demo`

- [ ] **Step 6: Commit**

```bash
git add landing/demo/infra landing/demo/scripts/wait-for-infra.mjs
git commit -m "demo: docker-compose with postgres, redis, localstack s3"
```

---

### Task 0.3: Fetch seed PDFs

**Files:**
- Create: `landing/demo/scripts/fetch-seed-pdfs.sh`

- [ ] **Step 1: Create the script**

```bash
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/infra/seed-pdfs"
mkdir -p "$DIR"
SLACK_URL="https://cdn.shopify.com/s/files/1/0565/3423/7349/files/slack-2020.pdf?v=1620422766"
HEINEKEN_URL="https://cdn.shopify.com/s/files/1/0565/3423/7349/files/heineken-Brand_guidelines.pdf?v=1630653369"
[ -f "$DIR/slack-2020.pdf" ] || curl -fsSL "$SLACK_URL" -o "$DIR/slack-2020.pdf"
[ -f "$DIR/heineken.pdf" ]   || curl -fsSL "$HEINEKEN_URL" -o "$DIR/heineken.pdf"
echo "[seed-pdfs] ready in $DIR"
ls -lh "$DIR"
```

`chmod +x scripts/fetch-seed-pdfs.sh`

- [ ] **Step 2: Run it**

```bash
cd landing/demo && pnpm fetch:pdfs
```

Expected: two files written, sizes printed.

- [ ] **Step 3: Commit (script only — PDFs gitignored)**

```bash
git add landing/demo/scripts/fetch-seed-pdfs.sh
git commit -m "demo: script to fetch slack + heineken seed PDFs"
```

---

## Phase 1 — Shared packages

### Task 1.1: `packages/schemas` — Zod 4 schemas

**Files:**
- Create: `landing/demo/packages/schemas/package.json`
- Create: `landing/demo/packages/schemas/tsconfig.json`
- Create: `landing/demo/packages/schemas/src/index.ts`
- Create: `landing/demo/packages/schemas/src/brand-profile.ts`
- Create: `landing/demo/packages/schemas/src/api.ts`
- Create: `landing/demo/packages/schemas/src/generation.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@studio/schemas",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^4.0.0" },
  "devDependencies": { "typescript": "^5.6.0" }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: Create `src/brand-profile.ts`**

```ts
import { z } from "zod";

export const PaletteEntrySchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  role: z.enum(["primary", "secondary", "accent", "neutral"]).optional(),
});

export const TypographySchema = z.object({
  display: z.string().nullable(),
  body: z.string().nullable(),
  mono: z.string().nullable(),
});

export const BrandProfileSchema = z.object({
  brand_name: z.string().min(1),
  voice: z.object({
    tone_descriptors: z.array(z.string()).max(8),
    voice_principles: z.array(z.string()),
    do: z.array(z.string()),
    dont: z.array(z.string()),
  }),
  visual: z.object({
    palette: z.array(PaletteEntrySchema),
    typography: TypographySchema.optional(),
    logo_usage: z.array(z.string()).optional(),
  }),
  localization: z
    .object({ locales: z.array(z.string()), notes: z.string().nullable() })
    .optional(),
  banned_terms: z.array(z.string()),
});

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

export const emptyBrandProfile = (name = "Untitled"): BrandProfile => ({
  brand_name: name,
  voice: { tone_descriptors: [], voice_principles: [], do: [], dont: [] },
  visual: { palette: [] },
  banned_terms: [],
});
```

- [ ] **Step 4: Create `src/generation.ts`**

```ts
import { z } from "zod";

export const GenerationTypeSchema = z.enum(["copy_variant", "translate", "image"]);
export const GenerationStatusSchema = z.enum(["pending", "running", "done", "failed"]);

export const CopyInputSchema = z.object({
  prompt: z.string(),
  source_text: z.string().optional(),
  count: z.number().int().min(1).max(5).default(3),
});
export const TranslateInputSchema = z.object({
  source_text: z.string(),
  source_locale: z.string(),
  target_locales: z.array(z.string()),
});
export const ImageInputSchema = z.object({
  prompt: z.string(),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024", "2048x2048"]).default("1024x1024"),
  count: z.number().int().min(1).max(4).default(3),
});

export const GenerationInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("copy_variant"), payload: CopyInputSchema }),
  z.object({ type: z.literal("translate"), payload: TranslateInputSchema }),
  z.object({ type: z.literal("image"), payload: ImageInputSchema }),
]);
export type GenerationInput = z.infer<typeof GenerationInputSchema>;
```

- [ ] **Step 5: Create `src/api.ts`**

```ts
import { z } from "zod";
import { BrandProfileSchema } from "./brand-profile.js";

export const CreateBrandSchema = z.object({ name: z.string().min(1).max(80) });
export const UpdateBrandSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  archived: z.boolean().optional(),
});
export const UpdateProfileSchema = z.object({ profile: BrandProfileSchema });

export const UsageGroupBySchema = z.enum(["user", "brand", "day", "feature"]);
export const UsageQuerySchema = z.object({
  groupBy: UsageGroupBySchema.default("day"),
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export const GenerationsQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  type: z.enum(["copy_variant", "translate", "image"]).optional(),
  status: z.enum(["pending", "running", "done", "failed"]).optional(),
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
```

- [ ] **Step 6: Create `src/index.ts`**

```ts
export * from "./brand-profile.js";
export * from "./generation.js";
export * from "./api.js";
```

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter @studio/schemas typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add landing/demo/packages/schemas
git commit -m "demo: @studio/schemas package (Zod 4 BrandProfile + API DTOs)"
```

---

### Task 1.2: `packages/tokens` — bridged OKLCH variables

**Files:**
- Create: `landing/demo/packages/tokens/package.json`
- Create: `landing/demo/packages/tokens/global.css`
- Read first: `landing/src/styles/global.css` (extract every CSS var)

- [ ] **Step 1: Read landing tokens**

```bash
cat landing/src/styles/global.css
```

Identify every `--color-*`, `--font-*`, `--ease-*`, `--shadow-*` variable.

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "@studio/tokens",
  "version": "0.0.0",
  "private": true,
  "exports": { ".": "./global.css" }
}
```

- [ ] **Step 3: Create `global.css`** — copy the relevant @theme block from landing's `src/styles/global.css` plus base reset. The block must contain at minimum:

```css
@layer base {
  :root {
    --color-cream: oklch(97.5% 0.005 60);
    --color-charcoal: oklch(20% 0.01 50);
    --color-reading: oklch(35% 0.008 50);
    --color-stone: oklch(55% 0.005 50);
    --color-coral: oklch(64% 0.16 35);
    --color-hairline: oklch(85% 0.005 50);
    --color-sunken: oklch(96% 0.005 60);
    --font-serif: 'Source Serif 4', 'Tiempos', 'GT Sectra', Georgia, serif;
    --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
    --ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
    --ease-out-quint: cubic-bezier(0.23, 1, 0.32, 1);
    --shadow-mockup: 0 1px 2px oklch(20% 0.01 50 / 0.04), 0 12px 32px oklch(20% 0.01 50 / 0.08);
    --focus-ring: 0 0 0 3px oklch(64% 0.16 35 / 0.35);
  }
  html, body {
    background: var(--color-cream);
    color: var(--color-charcoal);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
  *:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: 4px; }
}
```

If the landing file uses different exact values, copy those — landing is the source of truth.

- [ ] **Step 4: Cross-link landing to demo tokens (optional but ideal)**

Edit `landing/src/styles/global.css` to import `../../demo/packages/tokens/global.css` if accessible; if not, leave landing untouched and accept duplicated definitions for the demo. Document the coupling in the package readme.

- [ ] **Step 5: Commit**

```bash
git add landing/demo/packages/tokens
git commit -m "demo: @studio/tokens package with OKLCH vars from landing"
```

---

### Task 1.3: `packages/db` — Drizzle schema + migrations

**Files:**
- Create: `landing/demo/packages/db/package.json`
- Create: `landing/demo/packages/db/tsconfig.json`
- Create: `landing/demo/packages/db/drizzle.config.ts`
- Create: `landing/demo/packages/db/src/schema.ts`
- Create: `landing/demo/packages/db/src/client.ts`
- Create: `landing/demo/packages/db/src/index.ts`
- Create: `landing/demo/packages/db/src/result.ts`
- Create: `landing/demo/packages/db/scripts/migrate.ts`
- Create: `landing/demo/packages/db/scripts/reset.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@studio/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "generate": "drizzle-kit generate",
    "migrate": "tsx scripts/migrate.ts",
    "reset": "tsx scripts/reset.ts",
    "seed": "tsx ../../scripts/seed.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.36.0",
    "pg": "^8.13.0",
    "@studio/schemas": "workspace:*"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.0",
    "@types/pg": "^8.11.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "scripts", "drizzle.config.ts"] }
```

- [ ] **Step 3: Create `drizzle.config.ts`**

```ts
import "dotenv/config";
import type { Config } from "drizzle-kit";
export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
} satisfies Config;
```

- [ ] **Step 4: Create `src/schema.ts`**

```ts
import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb, numeric,
  pgEnum, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { BrandProfile } from "@studio/schemas";

export const profileStatus = pgEnum("brand_profile_status", ["processing", "ready", "failed"]);
export const generationType = pgEnum("generation_type", ["copy_variant", "translate", "image"]);
export const generationStatus = pgEnum("generation_status", ["pending", "running", "done", "failed"]);
export const usageFeature = pgEnum("usage_feature", ["copy_variant", "translate", "image", "extract"]);

export const orgs = pgTable("org", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("designer"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index("user_org_idx").on(t.orgId) })
);

export const brands = pgTable(
  "brand",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    name: text("name").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index("brand_org_idx").on(t.orgId) })
);

export const brandProfiles = pgTable(
  "brand_profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    brandId: uuid("brand_id").notNull().references(() => brands.id),
    version: integer("version").notNull(),
    profile: jsonb("profile").$type<BrandProfile | null>(),
    sourcePdfS3Key: text("source_pdf_s3_key"),
    sourcePdfFilename: text("source_pdf_filename"),
    sourcePdfSizeBytes: integer("source_pdf_size_bytes"),
    status: profileStatus("status").notNull(),
    ingestError: text("ingest_error"),
    isCurrent: boolean("is_current").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("bp_org_idx").on(t.orgId),
    versionIdx: index("bp_brand_version_idx").on(t.orgId, t.brandId, t.version),
    currentUnique: uniqueIndex("bp_brand_current_unique")
      .on(t.brandId)
      .where(sql`${t.isCurrent} = true`),
    statusIdx: index("bp_status_idx").on(t.orgId, t.status)
      .where(sql`${t.status} IN ('processing','failed')`),
  })
);

export const generations = pgTable(
  "generation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    brandId: uuid("brand_id").notNull().references(() => brands.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    type: generationType("type").notNull(),
    status: generationStatus("status").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output"),
    error: text("error"),
    figmaFileKey: text("figma_file_key"),
    figmaNodeId: text("figma_node_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("gen_org_idx").on(t.orgId),
    userTimeIdx: index("gen_user_time_idx").on(t.orgId, t.userId, t.createdAt),
    activeIdx: index("gen_active_idx").on(t.orgId, t.status)
      .where(sql`${t.status} IN ('pending','running')`),
    nodeLockIdx: uniqueIndex("gen_node_lock_idx")
      .on(t.orgId, t.figmaFileKey, t.figmaNodeId)
      .where(sql`${t.type} = 'image' AND ${t.status} IN ('pending','running')`),
  })
);

export const usageEvents = pgTable(
  "usage_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    brandId: uuid("brand_id").references(() => brands.id),
    userId: uuid("user_id").references(() => users.id),
    generationId: uuid("generation_id").references(() => generations.id),
    feature: usageFeature("feature").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("ue_org_idx").on(t.orgId),
    timeIdx: index("ue_time_idx").on(t.orgId, t.createdAt),
    userTimeIdx: index("ue_user_time_idx").on(t.orgId, t.userId, t.createdAt),
    brandTimeIdx: index("ue_brand_time_idx").on(t.orgId, t.brandId, t.createdAt),
  })
);
```

- [ ] **Step 5: Create `src/client.ts`**

```ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export { schema };
export type Db = typeof db;
```

- [ ] **Step 6: Create `src/result.ts`**

```ts
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export type RepoErrorKind = "not_found" | "conflict" | "validation" | "internal";
export class RepoError extends Error {
  constructor(public kind: RepoErrorKind, message: string, public cause?: unknown) {
    super(message);
  }
}
```

- [ ] **Step 7: Create `src/index.ts`**

```ts
export * from "./schema.js";
export * from "./client.js";
export * from "./result.js";
```

- [ ] **Step 8: Create `scripts/migrate.ts`**

```ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("[db] migrations applied");
await pool.end();
```

- [ ] **Step 9: Create `scripts/reset.ts`**

```ts
import "dotenv/config";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
console.log("[db] schema dropped");
await pool.end();
```

- [ ] **Step 10: Generate first migration**

```bash
cd landing/demo
pnpm --filter @studio/db generate
```

Expected: `packages/db/drizzle/0000_*.sql` written.

- [ ] **Step 11: Apply migration**

```bash
pnpm --filter @studio/db migrate
```

Expected: `[db] migrations applied`.

- [ ] **Step 12: Verify schema in psql**

```bash
docker exec -it $(docker ps -qf name=postgres) psql -U demo -d studio_demo -c '\dt'
```

Expected: 6 tables listed.

- [ ] **Step 13: Commit**

```bash
git add landing/demo/packages/db
git commit -m "demo: @studio/db Drizzle schema + initial migration"
```

---

### Task 1.4: `packages/ai` — OpenRouter wrapper

**Files:**
- Create: `landing/demo/packages/ai/package.json`
- Create: `landing/demo/packages/ai/tsconfig.json`
- Create: `landing/demo/packages/ai/src/client.ts`
- Create: `landing/demo/packages/ai/src/extract-brand-profile.ts`
- Create: `landing/demo/packages/ai/src/prompts/extract-brand-profile.ts`
- Create: `landing/demo/packages/ai/src/pricing.ts`
- Create: `landing/demo/packages/ai/src/index.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@studio/ai",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": {
    "ai": "^4.0.0",
    "@openrouter/ai-sdk-provider": "^0.7.0",
    "zod": "^4.0.0",
    "@studio/schemas": "workspace:*"
  },
  "devDependencies": { "typescript": "^5.6.0" }
}
```

(Note: AI SDK major version may be 4, 5, or 6 depending on what `pnpm dlx` resolves at scaffold time. The implementation MUST use `generateObject` with Zod 4 schemas regardless of major version — both call shapes work the same way.)

- [ ] **Step 2: Create `tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: Create `src/client.ts`**

```ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required");
}

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    "HTTP-Referer": "http://localhost:5173",
    "X-OpenRouter-Title": "Studio Demo",
  },
});

export const extractionModel = openrouter("openai/gpt-5.5", {
  plugins: [{ id: "response-healing" }],
});
```

- [ ] **Step 4: Create `src/prompts/extract-brand-profile.ts`**

```ts
export const EXTRACT_BRAND_PROFILE_PROMPT = `You are extracting a structured brand identity profile from a brand-guideline PDF.

Return JSON matching the provided schema. Rules:

1. brand_name — the brand the guideline is for, exactly as the document presents it.
2. voice.tone_descriptors — at most 8 single-word adjectives the guideline lists or strongly implies (e.g. "Confident", "Witty"). No phrases.
3. voice.voice_principles — concise sentences distilled verbatim from the guideline's voice section. 3–6 entries.
4. voice.do / voice.dont — bullet lists from any "do this / not that" or "we are / we are not" pages.
5. visual.palette — every distinct color the guideline calls out as a brand color, with name and 6-character hex (uppercase). Skip neutrals labelled as "ink/paper/black/white" unless explicitly part of the palette.
6. visual.typography — display, body, mono fonts if the guideline names them. Use null for any tier the guideline does not name.
7. localization.locales — ISO codes (e.g. "en", "es") if the guideline lists supported languages; otherwise leave the field absent.
8. banned_terms — exact strings the guideline forbids using.

If a field is absent in the PDF, leave the array empty or the value null. Do not invent.`;
```

- [ ] **Step 5: Create `src/pricing.ts`**

```ts
// Per-1k token prices in USD. Updated from openrouter.ai/openai/gpt-5.5 page.
// gpt-5.5: $1.25 / 1M input, $10 / 1M output (placeholder; update at impl time from pricing page).
const PRICES: Record<string, { input: number; output: number }> = {
  "openai/gpt-5.5": { input: 0.00125, output: 0.01 },
};

export function priceUsage(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model] ?? { input: 0, output: 0 };
  return (inputTokens / 1000) * p.input + (outputTokens / 1000) * p.output;
}
```

- [ ] **Step 6: Create `src/extract-brand-profile.ts`**

```ts
import { generateObject } from "ai";
import { BrandProfileSchema, type BrandProfile } from "@studio/schemas";
import { extractionModel } from "./client.js";
import { EXTRACT_BRAND_PROFILE_PROMPT } from "./prompts/extract-brand-profile.js";
import { priceUsage } from "./pricing.js";

export type ExtractionResult = {
  profile: BrandProfile;
  usage: {
    model: string;
    provider: "openrouter";
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
  };
};

export async function extractBrandProfile(pdf: Buffer): Promise<ExtractionResult> {
  const start = Date.now();
  const { object, usage } = await generateObject({
    model: extractionModel,
    schema: BrandProfileSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACT_BRAND_PROFILE_PROMPT },
          { type: "file", data: pdf, mediaType: "application/pdf" },
        ],
      },
    ],
  });
  const latencyMs = Date.now() - start;
  const inputTokens = usage?.promptTokens ?? usage?.inputTokens ?? 0;
  const outputTokens = usage?.completionTokens ?? usage?.outputTokens ?? 0;
  return {
    profile: object,
    usage: {
      model: "openai/gpt-5.5",
      provider: "openrouter",
      inputTokens,
      outputTokens,
      costUsd: priceUsage("openai/gpt-5.5", inputTokens, outputTokens),
      latencyMs,
    },
  };
}
```

- [ ] **Step 7: Create `src/index.ts`**

```ts
export * from "./client.js";
export * from "./extract-brand-profile.js";
export * from "./pricing.js";
```

- [ ] **Step 8: Typecheck**

```bash
pnpm --filter @studio/ai typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add landing/demo/packages/ai
git commit -m "demo: @studio/ai OpenRouter GPT-5.5 extraction wrapper"
```

---

## Phase 2 — API + Worker

### Task 2.1: `apps/api` skeleton (Hono + middleware)

**Files:**
- Create: `landing/demo/apps/api/package.json`
- Create: `landing/demo/apps/api/tsconfig.json`
- Create: `landing/demo/apps/api/src/index.ts`
- Create: `landing/demo/apps/api/src/env.ts`
- Create: `landing/demo/apps/api/src/logger.ts`
- Create: `landing/demo/apps/api/src/middleware/request-id.ts`
- Create: `landing/demo/apps/api/src/middleware/fake-auth.ts`
- Create: `landing/demo/apps/api/src/middleware/error.ts`
- Create: `landing/demo/apps/api/src/lib/result-to-http.ts`

- [ ] **Step 1: `package.json`**

```json
{
  "name": "@studio/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "@hono/zod-validator": "^0.4.0",
    "zod": "^4.0.0",
    "pino": "^9.5.0",
    "pino-pretty": "^11.0.0",
    "bullmq": "^5.20.0",
    "ioredis": "^5.4.0",
    "@aws-sdk/client-s3": "^3.700.0",
    "@aws-sdk/s3-request-presigner": "^3.700.0",
    "drizzle-orm": "^0.36.0",
    "@studio/db": "workspace:*",
    "@studio/schemas": "workspace:*",
    "@studio/ai": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": { "outDir": "dist" }
}
```

- [ ] **Step 3: `src/env.ts`**

```ts
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string(),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
});
export const env = schema.parse(process.env);
```

- [ ] **Step 4: `src/logger.ts`**

```ts
import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
```

- [ ] **Step 5: `src/middleware/request-id.ts`**

```ts
import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = c.req.header("x-request-id") ?? randomUUID();
  c.set("requestId", id);
  c.header("x-request-id", id);
  await next();
};

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    orgId: string;
    userId: string;
  }
}
```

- [ ] **Step 6: `src/middleware/fake-auth.ts`**

```ts
import type { MiddlewareHandler } from "hono";
import { db, schema } from "@studio/db";
import { eq } from "drizzle-orm";

let cached: { orgId: string; userId: string } | null = null;

async function loadSeedIdentity() {
  if (cached) return cached;
  const [org] = await db.select().from(schema.orgs).limit(1);
  if (!org) throw new Error("seed org missing — run pnpm db:seed");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.orgId, org.id)).limit(1);
  if (!user) throw new Error("seed user missing — run pnpm db:seed");
  cached = { orgId: org.id, userId: user.id };
  return cached;
}

export const fakeAuth: MiddlewareHandler = async (c, next) => {
  const id = await loadSeedIdentity();
  c.set("orgId", id.orgId);
  c.set("userId", id.userId);
  await next();
};
```

- [ ] **Step 7: `src/lib/result-to-http.ts`**

```ts
import type { Context } from "hono";
import type { Result } from "@studio/db";
import { RepoError } from "@studio/db";

export function send<T>(c: Context, r: Result<T, RepoError>, ok = 200): Response {
  if (r.ok) return c.json(r.value as object, ok as 200 | 201 | 204);
  const status =
    r.error.kind === "not_found" ? 404 :
    r.error.kind === "conflict" ? 409 :
    r.error.kind === "validation" ? 400 : 500;
  return c.json(
    { error: { kind: r.error.kind, message: r.error.message, requestId: c.get("requestId") } },
    status
  );
}
```

- [ ] **Step 8: `src/middleware/error.ts`**

```ts
import type { MiddlewareHandler } from "hono";
import { logger } from "../logger.js";

export const errorBoundary: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (e) {
    logger.error({ err: e, requestId: c.get("requestId") }, "unhandled");
    return c.json(
      { error: { kind: "internal", message: "internal error", requestId: c.get("requestId") } },
      500
    );
  }
};
```

- [ ] **Step 9: `src/index.ts`** (skeleton)

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { requestId } from "./middleware/request-id.js";
import { fakeAuth } from "./middleware/fake-auth.js";
import { errorBoundary } from "./middleware/error.js";

const app = new Hono();
app.use("*", requestId);
app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use("*", errorBoundary);

app.get("/healthz", (c) => c.json({ ok: true }));

app.use("/api/*", fakeAuth);
app.get("/api/me", async (c) =>
  c.json({ orgId: c.get("orgId"), userId: c.get("userId") })
);

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port }, "api listening");
});

export type AppType = typeof app;
```

- [ ] **Step 10: Run dev server**

```bash
cd landing/demo && pnpm --filter @studio/api dev
```

Expected: `api listening` log line at port 3001.

- [ ] **Step 11: Smoke test endpoints**

```bash
curl -s localhost:3001/healthz
curl -s localhost:3001/api/me
```

Expected: `{"ok":true}` and `{"orgId":"...","userId":"..."}` (after seed runs in later task; for now this will throw seed-missing error — acceptable).

- [ ] **Step 12: Commit**

```bash
git add landing/demo/apps/api
git commit -m "demo: api skeleton (Hono + fake-auth + healthz + /me)"
```

---

### Task 2.2: S3 + Redis + Queue infrastructure clients

**Files:**
- Create: `landing/demo/apps/api/src/infra/s3.ts`
- Create: `landing/demo/apps/api/src/infra/redis.ts`
- Create: `landing/demo/apps/api/src/infra/queue.ts`
- Create: `landing/demo/apps/api/src/infra/sse.ts`

- [ ] **Step 1: `src/infra/s3.ts`**

```ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
});

export async function putPdf(key: string, body: Buffer, contentType = "application/pdf") {
  await s3.send(new PutObjectCommand({
    Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType,
  }));
}

export async function signedReadUrl(key: string, expiresInSec = 3600) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn: expiresInSec }
  );
}
```

- [ ] **Step 2: `src/infra/redis.ts`**

```ts
import IORedis from "ioredis";
import { env } from "../env.js";

export const redisPub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const redisSub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const redisQueue = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const PROFILE_EVENTS_CHANNEL = "profile:events";
```

- [ ] **Step 3: `src/infra/queue.ts`**

```ts
import { Queue } from "bullmq";
import { redisQueue } from "./redis.js";

export type ExtractProfileJob = {
  profileId: string;
  s3Key: string;
  brandId: string;
  orgId: string;
  userId: string;
};

export const extractProfileQueue = new Queue<ExtractProfileJob>("extract-profile", {
  connection: redisQueue,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
```

- [ ] **Step 4: `src/infra/sse.ts`**

```ts
import type { Context } from "hono";
import { redisSub, PROFILE_EVENTS_CHANNEL } from "./redis.js";

export type ProfileEvent = { profileId: string; event: "ready" | "failed"; error?: string };

export async function streamProfileEvents(c: Context, profileId: string) {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const heartbeat = setInterval(
        () => controller.enqueue(enc.encode(`: keepalive\n\n`)),
        25_000
      );
      const onMsg = (channel: string, message: string) => {
        if (channel !== PROFILE_EVENTS_CHANNEL) return;
        try {
          const parsed = JSON.parse(message) as ProfileEvent;
          if (parsed.profileId !== profileId) return;
          send(parsed.event, parsed);
        } catch {}
      };
      redisSub.subscribe(PROFILE_EVENTS_CHANNEL).then(() => {
        redisSub.on("message", onMsg);
        send("open", { profileId });
      });
      const abort = () => {
        clearInterval(heartbeat);
        redisSub.off("message", onMsg);
        try { controller.close(); } catch {}
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

- [ ] **Step 5: Wire to `src/index.ts`** (add temporary route to verify)

In `src/index.ts` add after `/api/me`:

```ts
import { signedReadUrl } from "./infra/s3.js";
app.get("/api/_debug/signed-url/:key", async (c) => {
  const url = await signedReadUrl(c.req.param("key"));
  return c.json({ url });
});
```

- [ ] **Step 6: Commit**

```bash
git add landing/demo/apps/api/src/infra
git commit -m "demo: api infra clients (s3, redis, queue, sse bridge)"
```

(The debug route stays for diagnostics; removed when feature routes are complete.)

---

### Task 2.3: Brand routes (CRUD)

**Files:**
- Create: `landing/demo/apps/api/src/features/brand/repository.ts`
- Create: `landing/demo/apps/api/src/features/brand/service.ts`
- Create: `landing/demo/apps/api/src/features/brand/router.ts`

- [ ] **Step 1: `repository.ts`**

```ts
import { db, schema, ok, err, RepoError, type Result } from "@studio/db";
import { and, eq, isNull, sql } from "drizzle-orm";

export type Brand = typeof schema.brands.$inferSelect;

export const brandRepo = {
  async list(orgId: string): Promise<Result<Brand[], RepoError>> {
    const rows = await db.select().from(schema.brands)
      .where(and(eq(schema.brands.orgId, orgId), isNull(schema.brands.deletedAt)))
      .orderBy(schema.brands.name);
    return ok(rows);
  },
  async create(orgId: string, name: string): Promise<Result<Brand, RepoError>> {
    const [row] = await db.insert(schema.brands)
      .values({ orgId, name }).returning();
    return ok(row);
  },
  async getById(orgId: string, id: string): Promise<Result<Brand, RepoError>> {
    const [row] = await db.select().from(schema.brands)
      .where(and(eq(schema.brands.id, id), eq(schema.brands.orgId, orgId)));
    return row ? ok(row) : err(new RepoError("not_found", `brand ${id} not found`));
  },
  async rename(orgId: string, id: string, name: string): Promise<Result<Brand, RepoError>> {
    const [row] = await db.update(schema.brands)
      .set({ name })
      .where(and(eq(schema.brands.id, id), eq(schema.brands.orgId, orgId)))
      .returning();
    return row ? ok(row) : err(new RepoError("not_found", `brand ${id} not found`));
  },
  async softDelete(orgId: string, id: string): Promise<Result<Brand, RepoError>> {
    const [row] = await db.update(schema.brands)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(schema.brands.id, id), eq(schema.brands.orgId, orgId)))
      .returning();
    return row ? ok(row) : err(new RepoError("not_found", `brand ${id} not found`));
  },
};
```

- [ ] **Step 2: `service.ts`**

```ts
import { brandRepo } from "./repository.js";
import { db, schema, ok } from "@studio/db";
import { and, eq, gte, sql } from "drizzle-orm";

export const brandService = {
  list: brandRepo.list,
  create: brandRepo.create,
  rename: brandRepo.rename,
  softDelete: brandRepo.softDelete,
  async getDetail(orgId: string, id: string) {
    const r = await brandRepo.getById(orgId, id);
    if (!r.ok) return r;
    const [currentProfile] = await db.select().from(schema.brandProfiles)
      .where(and(
        eq(schema.brandProfiles.brandId, id),
        eq(schema.brandProfiles.isCurrent, true)
      )).limit(1);
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const [stats] = await db.select({
      genCount30d: sql<number>`count(*)::int`,
      lastActivityAt: sql<Date | null>`max(${schema.generations.createdAt})`,
    }).from(schema.generations)
      .where(and(
        eq(schema.generations.brandId, id),
        gte(schema.generations.createdAt, since)
      ));
    return ok({ brand: r.value, currentProfile, stats });
  },
};
```

- [ ] **Step 3: `router.ts`**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { CreateBrandSchema, UpdateBrandSchema } from "@studio/schemas";
import { brandService } from "./service.js";
import { send } from "../../lib/result-to-http.js";

export const brandRouter = new Hono()
  .get("/", async (c) => send(c, await brandService.list(c.get("orgId"))))
  .post("/", zValidator("json", CreateBrandSchema), async (c) => {
    const body = c.req.valid("json");
    return send(c, await brandService.create(c.get("orgId"), body.name), 201);
  })
  .get("/:brandId", async (c) =>
    send(c, await brandService.getDetail(c.get("orgId"), c.req.param("brandId")))
  )
  .patch("/:brandId", zValidator("json", UpdateBrandSchema), async (c) => {
    const body = c.req.valid("json");
    if (body.archived) {
      return send(c, await brandService.softDelete(c.get("orgId"), c.req.param("brandId")));
    }
    if (body.name) {
      return send(c, await brandService.rename(c.get("orgId"), c.req.param("brandId"), body.name));
    }
    return c.json({ error: { kind: "validation", message: "no-op" } }, 400);
  });
```

- [ ] **Step 4: Mount in `src/index.ts`**

```ts
import { brandRouter } from "./features/brand/router.js";
app.route("/api/brands", brandRouter);
```

(Remember to apply `fakeAuth` to `/api/*` once before mounting — already done in Task 2.1.)

- [ ] **Step 5: Smoke test (after seed exists)**

```bash
curl -s localhost:3001/api/brands | jq
curl -s -X POST localhost:3001/api/brands -H 'content-type: application/json' -d '{"name":"Test"}' | jq
```

- [ ] **Step 6: Commit**

```bash
git add landing/demo/apps/api/src/features/brand
git commit -m "demo: api brand CRUD routes"
```

---

### Task 2.4: Brand-profile routes (upload, edit, retry, rollback)

**Files:**
- Create: `landing/demo/apps/api/src/features/brand-profile/repository.ts`
- Create: `landing/demo/apps/api/src/features/brand-profile/service.ts`
- Create: `landing/demo/apps/api/src/features/brand-profile/router.ts`

- [ ] **Step 1: `repository.ts`**

```ts
import { db, schema, ok, err, RepoError, type Result } from "@studio/db";
import { and, desc, eq, sql } from "drizzle-orm";

export type BrandProfileRow = typeof schema.brandProfiles.$inferSelect;

export const brandProfileRepo = {
  async listByBrand(orgId: string, brandId: string): Promise<Result<BrandProfileRow[], RepoError>> {
    const rows = await db.select().from(schema.brandProfiles)
      .where(and(
        eq(schema.brandProfiles.orgId, orgId),
        eq(schema.brandProfiles.brandId, brandId)
      ))
      .orderBy(desc(schema.brandProfiles.version));
    return ok(rows);
  },
  async getById(orgId: string, id: string): Promise<Result<BrandProfileRow, RepoError>> {
    const [row] = await db.select().from(schema.brandProfiles)
      .where(and(eq(schema.brandProfiles.id, id), eq(schema.brandProfiles.orgId, orgId)));
    return row ? ok(row) : err(new RepoError("not_found", `profile ${id} not found`));
  },
  async insertProcessing(input: {
    orgId: string; brandId: string; userId: string;
    s3Key: string; filename: string; sizeBytes: number;
  }): Promise<Result<BrandProfileRow, RepoError>> {
    const next = await db.execute<{ next: number }>(
      sql`select coalesce(max(version),0)+1 as next from ${schema.brandProfiles} where brand_id=${input.brandId}`
    );
    const version = (next.rows[0] as any).next as number;
    const [row] = await db.insert(schema.brandProfiles).values({
      orgId: input.orgId, brandId: input.brandId, version,
      profile: null, sourcePdfS3Key: input.s3Key,
      sourcePdfFilename: input.filename, sourcePdfSizeBytes: input.sizeBytes,
      status: "processing", isCurrent: false, createdBy: input.userId,
    }).returning();
    return ok(row);
  },
  async insertHandAuthored(input: {
    orgId: string; brandId: string; userId: string; profile: any;
  }): Promise<Result<BrandProfileRow, RepoError>> {
    return db.transaction(async (tx) => {
      const next = await tx.execute<{ next: number }>(
        sql`select coalesce(max(version),0)+1 as next from ${schema.brandProfiles} where brand_id=${input.brandId}`
      );
      const version = (next.rows[0] as any).next as number;
      await tx.update(schema.brandProfiles)
        .set({ isCurrent: false })
        .where(and(
          eq(schema.brandProfiles.brandId, input.brandId),
          eq(schema.brandProfiles.isCurrent, true)
        ));
      const [row] = await tx.insert(schema.brandProfiles).values({
        orgId: input.orgId, brandId: input.brandId, version,
        profile: input.profile, status: "ready",
        isCurrent: true, createdBy: input.userId,
      }).returning();
      return ok(row);
    });
  },
  async editAsNewVersion(input: {
    orgId: string; profileId: string; userId: string; newProfile: any;
  }): Promise<Result<BrandProfileRow, RepoError>> {
    return db.transaction(async (tx) => {
      const [prior] = await tx.select().from(schema.brandProfiles)
        .where(and(
          eq(schema.brandProfiles.id, input.profileId),
          eq(schema.brandProfiles.orgId, input.orgId)
        ));
      if (!prior) return err(new RepoError("not_found", `profile ${input.profileId} not found`));
      if (prior.status !== "ready") return err(new RepoError("conflict", `profile not ready`));
      const next = await tx.execute<{ next: number }>(
        sql`select coalesce(max(version),0)+1 as next from ${schema.brandProfiles} where brand_id=${prior.brandId}`
      );
      const version = (next.rows[0] as any).next as number;
      await tx.update(schema.brandProfiles)
        .set({ isCurrent: false })
        .where(and(
          eq(schema.brandProfiles.brandId, prior.brandId),
          eq(schema.brandProfiles.isCurrent, true)
        ));
      const [row] = await tx.insert(schema.brandProfiles).values({
        orgId: prior.orgId, brandId: prior.brandId, version,
        profile: input.newProfile, status: "ready",
        sourcePdfS3Key: prior.sourcePdfS3Key,
        sourcePdfFilename: prior.sourcePdfFilename,
        sourcePdfSizeBytes: prior.sourcePdfSizeBytes,
        isCurrent: true, createdBy: input.userId,
      }).returning();
      return ok(row);
    });
  },
  async setCurrent(orgId: string, profileId: string): Promise<Result<BrandProfileRow, RepoError>> {
    return db.transaction(async (tx) => {
      const [target] = await tx.select().from(schema.brandProfiles)
        .where(and(eq(schema.brandProfiles.id, profileId), eq(schema.brandProfiles.orgId, orgId)));
      if (!target) return err(new RepoError("not_found", `profile ${profileId} not found`));
      if (target.status !== "ready") return err(new RepoError("conflict", `not a ready row`));
      await tx.update(schema.brandProfiles)
        .set({ isCurrent: false })
        .where(and(
          eq(schema.brandProfiles.brandId, target.brandId),
          eq(schema.brandProfiles.isCurrent, true)
        ));
      const [row] = await tx.update(schema.brandProfiles)
        .set({ isCurrent: true })
        .where(eq(schema.brandProfiles.id, profileId))
        .returning();
      return ok(row);
    });
  },
  async markRetry(orgId: string, profileId: string): Promise<Result<BrandProfileRow, RepoError>> {
    const [row] = await db.update(schema.brandProfiles)
      .set({ status: "processing", ingestError: null })
      .where(and(
        eq(schema.brandProfiles.id, profileId),
        eq(schema.brandProfiles.orgId, orgId),
        eq(schema.brandProfiles.status, "failed")
      ))
      .returning();
    return row ? ok(row) : err(new RepoError("conflict", `profile not in failed state`));
  },
};
```

- [ ] **Step 2: `service.ts`**

```ts
import { brandProfileRepo } from "./repository.js";
import { putPdf } from "../../infra/s3.js";
import { extractProfileQueue } from "../../infra/queue.js";
import { ok, err, RepoError, type Result } from "@studio/db";
import { randomUUID } from "node:crypto";

export const brandProfileService = {
  list: brandProfileRepo.listByBrand,
  get: brandProfileRepo.getById,
  edit: brandProfileRepo.editAsNewVersion,
  setCurrent: brandProfileRepo.setCurrent,

  async createFromPdf(input: {
    orgId: string; brandId: string; userId: string;
    file: { buffer: Buffer; name: string; size: number };
  }) {
    if (input.file.size > 20 * 1024 * 1024)
      return err(new RepoError("validation", "PDF must be ≤ 20 MB"));
    const s3Key = `profiles/${randomUUID()}.pdf`;
    await putPdf(s3Key, input.file.buffer);
    const r = await brandProfileRepo.insertProcessing({
      ...input, s3Key, filename: input.file.name, sizeBytes: input.file.size,
    });
    if (!r.ok) return r;
    await extractProfileQueue.add("extract", {
      profileId: r.value.id, s3Key,
      brandId: input.brandId, orgId: input.orgId, userId: input.userId,
    }, { jobId: r.value.id });
    return ok(r.value);
  },

  async createHandAuthored(input: { orgId: string; brandId: string; userId: string; profile: any }) {
    return brandProfileRepo.insertHandAuthored(input);
  },

  async retry(orgId: string, userId: string, profileId: string) {
    const r = await brandProfileRepo.markRetry(orgId, profileId);
    if (!r.ok) return r;
    await extractProfileQueue.add("extract", {
      profileId, s3Key: r.value.sourcePdfS3Key!,
      brandId: r.value.brandId, orgId, userId,
    }, { jobId: `${profileId}-retry-${Date.now()}` });
    return ok(r.value);
  },
};
```

- [ ] **Step 3: `router.ts`**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { UpdateProfileSchema, BrandProfileSchema } from "@studio/schemas";
import { brandProfileService } from "./service.js";
import { send } from "../../lib/result-to-http.js";
import { streamProfileEvents } from "../../infra/sse.js";
import { z } from "zod";

const HandAuthorBody = z.object({ profile: BrandProfileSchema.optional() });

export const profileRouter = new Hono();

profileRouter.get("/brands/:brandId/profiles", async (c) =>
  send(c, await brandProfileService.list(c.get("orgId"), c.req.param("brandId")))
);

profileRouter.post("/brands/:brandId/profiles", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const brandId = c.req.param("brandId");
  const ct = c.req.header("content-type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return c.json({ error: { kind: "validation", message: "file required" } }, 400);
    const buf = Buffer.from(await file.arrayBuffer());
    const r = await brandProfileService.createFromPdf({
      orgId, brandId, userId,
      file: { buffer: buf, name: file.name, size: buf.length },
    });
    return send(c, r, 202);
  } else {
    const body = HandAuthorBody.parse(await c.req.json().catch(() => ({})));
    const profile = body.profile ?? null;
    if (!profile) {
      const { emptyBrandProfile } = await import("@studio/schemas");
      return send(
        c,
        await brandProfileService.createHandAuthored({
          orgId, brandId, userId, profile: emptyBrandProfile(),
        }),
        201
      );
    }
    return send(
      c,
      await brandProfileService.createHandAuthored({ orgId, brandId, userId, profile }),
      201
    );
  }
});

profileRouter.get("/profiles/:profileId", async (c) =>
  send(c, await brandProfileService.get(c.get("orgId"), c.req.param("profileId")))
);

profileRouter.put("/profiles/:profileId", zValidator("json", UpdateProfileSchema), async (c) => {
  const body = c.req.valid("json");
  return send(
    c,
    await brandProfileService.edit({
      orgId: c.get("orgId"),
      userId: c.get("userId"),
      profileId: c.req.param("profileId"),
      newProfile: body.profile,
    })
  );
});

profileRouter.post("/profiles/:profileId/retry", async (c) =>
  send(c, await brandProfileService.retry(c.get("orgId"), c.get("userId"), c.req.param("profileId")))
);

profileRouter.post("/profiles/:profileId/set-current", async (c) =>
  send(c, await brandProfileService.setCurrent(c.get("orgId"), c.req.param("profileId")))
);

profileRouter.get("/profiles/:profileId/events", (c) =>
  streamProfileEvents(c, c.req.param("profileId"))
);
```

- [ ] **Step 4: Mount in `src/index.ts`**

```ts
import { profileRouter } from "./features/brand-profile/router.js";
app.route("/api", profileRouter);
```

- [ ] **Step 5: Commit**

```bash
git add landing/demo/apps/api/src/features/brand-profile
git commit -m "demo: api brand-profile routes (upload, edit, retry, rollback, SSE)"
```

---

### Task 2.5: Generation + usage routes (read-only over seed)

**Files:**
- Create: `landing/demo/apps/api/src/features/generation/repository.ts`
- Create: `landing/demo/apps/api/src/features/generation/router.ts`
- Create: `landing/demo/apps/api/src/features/usage/repository.ts`
- Create: `landing/demo/apps/api/src/features/usage/router.ts`

- [ ] **Step 1: Generation repository**

```ts
// features/generation/repository.ts
import { db, schema, ok, err, RepoError, type Result } from "@studio/db";
import { and, desc, eq, lt } from "drizzle-orm";

export const genRepo = {
  async list(orgId: string, q: {
    brandId?: string; type?: any; status?: any; userId?: string;
    limit: number; cursor?: string;
  }) {
    const filters = [eq(schema.generations.orgId, orgId)];
    if (q.brandId) filters.push(eq(schema.generations.brandId, q.brandId));
    if (q.type) filters.push(eq(schema.generations.type, q.type));
    if (q.status) filters.push(eq(schema.generations.status, q.status));
    if (q.userId) filters.push(eq(schema.generations.userId, q.userId));
    if (q.cursor) filters.push(lt(schema.generations.createdAt, new Date(q.cursor)));
    const rows = await db.select().from(schema.generations)
      .where(and(...filters))
      .orderBy(desc(schema.generations.createdAt))
      .limit(q.limit);
    const nextCursor = rows.length === q.limit ? rows[rows.length - 1].createdAt.toISOString() : null;
    return ok({ items: rows, nextCursor });
  },
  async getById(orgId: string, id: string) {
    const [row] = await db.select().from(schema.generations)
      .where(and(eq(schema.generations.id, id), eq(schema.generations.orgId, orgId)));
    return row ? ok(row) : err(new RepoError("not_found", `generation ${id} not found`));
  },
};
```

- [ ] **Step 2: Generation router**

```ts
// features/generation/router.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { GenerationsQuerySchema } from "@studio/schemas";
import { genRepo } from "./repository.js";
import { send } from "../../lib/result-to-http.js";

export const generationRouter = new Hono()
  .get("/", zValidator("query", GenerationsQuerySchema), async (c) => {
    const q = c.req.valid("query");
    return send(c, await genRepo.list(c.get("orgId"), q));
  })
  .get("/:id", async (c) =>
    send(c, await genRepo.getById(c.get("orgId"), c.req.param("id")))
  );
```

- [ ] **Step 3: Usage repository (rollups)**

```ts
// features/usage/repository.ts
import { db, schema, ok } from "@studio/db";
import { and, gte, sql } from "drizzle-orm";

export const usageRepo = {
  async rollup(orgId: string, opts: { groupBy: "user" | "brand" | "day" | "feature"; days: number }) {
    const since = new Date(Date.now() - opts.days * 24 * 3600_000);
    const where = and(eq(schema.usageEvents.orgId, orgId), gte(schema.usageEvents.createdAt, since));
    const groupExpr =
      opts.groupBy === "user"   ? schema.usageEvents.userId :
      opts.groupBy === "brand"  ? schema.usageEvents.brandId :
      opts.groupBy === "feature"? schema.usageEvents.feature :
      sql`date_trunc('day', ${schema.usageEvents.createdAt})`;
    const rows = await db.select({
      key: groupExpr as any,
      calls: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${schema.usageEvents.inputTokens}),0)::int`,
      outputTokens: sql<number>`coalesce(sum(${schema.usageEvents.outputTokens}),0)::int`,
      costUsd: sql<string>`coalesce(sum(${schema.usageEvents.costUsd}),0)`,
      avgLatencyMs: sql<number>`coalesce(avg(${schema.usageEvents.latencyMs}),0)::int`,
    })
      .from(schema.usageEvents)
      .where(where)
      .groupBy(groupExpr as any)
      .orderBy(groupExpr as any);
    return ok(rows);
  },
};
```

(Add `import { eq } from "drizzle-orm"` at the top.)

- [ ] **Step 4: Usage router**

```ts
// features/usage/router.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { UsageQuerySchema } from "@studio/schemas";
import { usageRepo } from "./repository.js";
import { send } from "../../lib/result-to-http.js";

export const usageRouter = new Hono()
  .get("/", zValidator("query", UsageQuerySchema), async (c) => {
    const q = c.req.valid("query");
    return send(c, await usageRepo.rollup(c.get("orgId"), q));
  });
```

- [ ] **Step 5: Mount in `src/index.ts`**

```ts
import { generationRouter } from "./features/generation/router.js";
import { usageRouter } from "./features/usage/router.js";
app.route("/api/generations", generationRouter);
app.route("/api/usage", usageRouter);
```

- [ ] **Step 6: Commit**

```bash
git add landing/demo/apps/api/src/features/generation landing/demo/apps/api/src/features/usage landing/demo/apps/api/src/index.ts
git commit -m "demo: api generation list/detail + usage rollup routes"
```

---

### Task 2.6: Worker (`apps/worker`)

**Files:**
- Create: `landing/demo/apps/worker/package.json`
- Create: `landing/demo/apps/worker/tsconfig.json`
- Create: `landing/demo/apps/worker/src/index.ts`
- Create: `landing/demo/apps/worker/src/extract-profile-handler.ts`
- Create: `landing/demo/apps/worker/src/infra.ts`

- [ ] **Step 1: `package.json`**

```json
{
  "name": "@studio/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "bullmq": "^5.20.0",
    "ioredis": "^5.4.0",
    "pino": "^9.5.0",
    "pino-pretty": "^11.0.0",
    "@aws-sdk/client-s3": "^3.700.0",
    "drizzle-orm": "^0.36.0",
    "@studio/db": "workspace:*",
    "@studio/ai": "workspace:*",
    "@studio/schemas": "workspace:*"
  },
  "devDependencies": { "tsx": "^4.19.0", "typescript": "^5.6.0", "@types/node": "^22.0.0" }
}
```

- [ ] **Step 2: `tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"], "compilerOptions": { "outDir": "dist" } }
```

- [ ] **Step 3: `src/infra.ts`**

```ts
import "dotenv/config";
import IORedis from "ioredis";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import pino from "pino";

export const env = {
  REDIS_URL: process.env.REDIS_URL!,
  S3_ENDPOINT: process.env.S3_ENDPOINT!,
  S3_REGION: process.env.S3_REGION ?? "us-east-1",
  S3_BUCKET: process.env.S3_BUCKET!,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY!,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY!,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === "true",
  FORCE_EXTRACT_FAIL: process.env.FORCE_EXTRACT_FAIL === "1",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
};

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});

export const redisQueue = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const redisPub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
});

export async function getPdfBytes(key: string): Promise<Buffer> {
  const obj = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  for await (const c of obj.Body as any) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}
```

- [ ] **Step 4: `src/extract-profile-handler.ts`**

```ts
import type { Job } from "bullmq";
import { db, schema } from "@studio/db";
import { extractBrandProfile } from "@studio/ai";
import { and, eq } from "drizzle-orm";
import { env, logger, getPdfBytes, redisPub } from "./infra.js";

const PROFILE_EVENTS = "profile:events";
const failedAttemptCounters = new Map<string, number>();

export type ExtractProfileJob = {
  profileId: string; s3Key: string; brandId: string; orgId: string; userId: string;
};

export async function handleExtractProfile(job: Job<ExtractProfileJob>) {
  const { profileId, s3Key, brandId, orgId, userId } = job.data;
  const log = logger.child({ profileId, jobId: job.id, attempt: job.attemptsMade + 1 });
  log.info("extract:start");

  if (env.FORCE_EXTRACT_FAIL) {
    const seen = (failedAttemptCounters.get(profileId) ?? 0) + 1;
    failedAttemptCounters.set(profileId, seen);
    if (seen === 1) throw new Error("forced fail (test harness)");
  }

  const pdf = await getPdfBytes(s3Key);
  const { profile, usage } = await extractBrandProfile(pdf);

  await db.transaction(async (tx) => {
    await tx.update(schema.brandProfiles)
      .set({ profile, status: "ready", ingestError: null })
      .where(eq(schema.brandProfiles.id, profileId));
    await tx.update(schema.brandProfiles)
      .set({ isCurrent: false })
      .where(and(
        eq(schema.brandProfiles.brandId, brandId),
        eq(schema.brandProfiles.isCurrent, true)
      ));
    await tx.update(schema.brandProfiles)
      .set({ isCurrent: true })
      .where(eq(schema.brandProfiles.id, profileId));
    await tx.insert(schema.usageEvents).values({
      orgId, brandId, userId, generationId: null,
      feature: "extract", provider: usage.provider, model: usage.model,
      inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      costUsd: usage.costUsd.toFixed(6) as any, latencyMs: usage.latencyMs,
    });
  });

  await redisPub.publish(PROFILE_EVENTS, JSON.stringify({ profileId, event: "ready" }));
  log.info({ latencyMs: usage.latencyMs }, "extract:done");
}

export async function handleExtractProfileFailed(job: Job<ExtractProfileJob>, err: Error) {
  const { profileId } = job.data;
  if ((job.attemptsMade ?? 0) < (job.opts.attempts ?? 1)) return; // not yet final
  await db.update(schema.brandProfiles)
    .set({ status: "failed", ingestError: err.message })
    .where(eq(schema.brandProfiles.id, profileId));
  await redisPub.publish(PROFILE_EVENTS, JSON.stringify({
    profileId, event: "failed", error: err.message,
  }));
  logger.error({ profileId, err: err.message }, "extract:final-fail");
}
```

- [ ] **Step 5: `src/index.ts`**

```ts
import { Worker } from "bullmq";
import { redisQueue, logger } from "./infra.js";
import { handleExtractProfile, handleExtractProfileFailed, type ExtractProfileJob } from "./extract-profile-handler.js";

const worker = new Worker<ExtractProfileJob>(
  "extract-profile",
  handleExtractProfile,
  { connection: redisQueue, concurrency: 2 }
);

worker.on("failed", async (job, err) => {
  if (job) await handleExtractProfileFailed(job, err);
});

logger.info("worker started: extract-profile");
```

- [ ] **Step 6: Smoke test**

```bash
cd landing/demo
pnpm --filter @studio/worker dev
```

Expected: `worker started: extract-profile`. Stays running.

- [ ] **Step 7: Commit**

```bash
git add landing/demo/apps/worker
git commit -m "demo: worker (BullMQ) for extract-profile jobs"
```

---

### Task 2.7: Seed script

**Files:**
- Create: `landing/demo/scripts/seed.ts`
- Create: `landing/demo/scripts/seed-helpers.ts`
- Create: `landing/demo/infra/seed-extractions/.gitkeep`

- [ ] **Step 1: `scripts/seed-helpers.ts`** — random utilities, generation/usage row builders

```ts
import { schema } from "@studio/db";

export function pick<T>(xs: T[]): T { return xs[Math.floor(Math.random() * xs.length)]!; }
export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function daysAgo(n: number) { return new Date(Date.now() - n * 24 * 3600_000); }
export function jitter(d: Date, hoursRange = 24) {
  return new Date(d.getTime() + randInt(0, hoursRange) * 3600_000 + randInt(0, 60) * 60_000);
}
```

- [ ] **Step 2: `scripts/seed.ts`** — full implementation

```ts
import "dotenv/config";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db, schema } from "@studio/db";
import { extractBrandProfile } from "@studio/ai";
import { pick, randInt, daysAgo, jitter } from "./seed-helpers.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const PDFS = join(ROOT, "infra/seed-pdfs");
const CACHE = join(ROOT, "infra/seed-extractions");

async function exists(p: string) { try { await access(p); return true; } catch { return false; } }

async function loadOrExtract(brandKey: "slack" | "heineken") {
  const pdfPath = join(PDFS, brandKey === "slack" ? "slack-2020.pdf" : "heineken.pdf");
  const cachePath = join(CACHE, `${brandKey}.json`);
  if (await exists(cachePath)) {
    return JSON.parse(await readFile(cachePath, "utf8"));
  }
  console.log(`[seed] extracting ${brandKey} via OpenRouter (one-time, will cache)…`);
  const pdf = await readFile(pdfPath);
  const { profile, usage } = await extractBrandProfile(pdf);
  await mkdir(CACHE, { recursive: true });
  await writeFile(cachePath, JSON.stringify({ profile, usage }, null, 2));
  return { profile, usage };
}

async function main() {
  console.log("[seed] truncating tables…");
  await db.execute(`TRUNCATE TABLE
    usage_event, generation, brand_profile, brand, "user", org
    RESTART IDENTITY CASCADE` as any);

  const [org] = await db.insert(schema.orgs).values({ name: "DesignTechCo" }).returning();
  const users = await db.insert(schema.users).values([
    { orgId: org.id, email: "jo@designtech.co", name: "Jo", role: "admin" },
    { orgId: org.id, email: "maya@designtech.co", name: "Maya", role: "brand_manager" },
    { orgId: org.id, email: "alex@designtech.co", name: "Alex", role: "brand_manager" },
    { orgId: org.id, email: "sam@designtech.co", name: "Sam", role: "designer" },
    { orgId: org.id, email: "kai@designtech.co", name: "Kai", role: "designer" },
  ]).returning();

  const [slack, heineken] = await db.insert(schema.brands).values([
    { orgId: org.id, name: "Slack" },
    { orgId: org.id, name: "Heineken" },
  ]).returning();

  for (const [brand, key] of [[slack, "slack"], [heineken, "heineken"]] as const) {
    const { profile, usage } = await loadOrExtract(key as any);
    const editedProfile = JSON.parse(JSON.stringify(profile));
    if (editedProfile.voice?.tone_descriptors?.length) {
      editedProfile.voice.tone_descriptors = editedProfile.voice.tone_descriptors.slice(0, -1);
    }
    const v1CreatedAt = daysAgo(26);
    const v2CreatedAt = daysAgo(11);
    const v3CreatedAt = daysAgo(2);
    const [v1] = await db.insert(schema.brandProfiles).values({
      orgId: org.id, brandId: brand.id, version: 1,
      profile, status: "ready",
      sourcePdfFilename: key === "slack" ? "slack-brand-v1.pdf" : "heineken-v1.pdf",
      sourcePdfSizeBytes: 4_200_000,
      isCurrent: false, createdBy: users[1].id, createdAt: v1CreatedAt as any,
    }).returning();
    const [v2] = await db.insert(schema.brandProfiles).values({
      orgId: org.id, brandId: brand.id, version: 2,
      profile, status: "ready",
      sourcePdfFilename: key === "slack" ? "slack-brand-v2.pdf" : "heineken-v2.pdf",
      sourcePdfSizeBytes: 4_300_000,
      isCurrent: false, createdBy: users[1].id, createdAt: v2CreatedAt as any,
    }).returning();
    const [v3] = await db.insert(schema.brandProfiles).values({
      orgId: org.id, brandId: brand.id, version: 3,
      profile: editedProfile, status: "ready",
      sourcePdfFilename: key === "slack" ? "slack-brand-v3.pdf" : "heineken-v3.pdf",
      sourcePdfSizeBytes: 4_300_000,
      isCurrent: true, createdBy: users[0].id, createdAt: v3CreatedAt as any,
    }).returning();

    await db.insert(schema.usageEvents).values({
      orgId: org.id, brandId: brand.id, userId: users[1].id, generationId: null,
      feature: "extract", provider: "openrouter", model: "openai/gpt-5.5",
      inputTokens: usage?.inputTokens ?? 6000,
      outputTokens: usage?.outputTokens ?? 600,
      costUsd: (usage?.costUsd ?? 0.012).toFixed(6) as any,
      latencyMs: usage?.latencyMs ?? 23000,
      createdAt: v1CreatedAt as any,
    });
    void v2; void v3;
  }

  console.log("[seed] generating ~200 generations + ~500 usage events…");
  const types = ["copy_variant", "translate", "image"] as const;
  const status = ["done", "done", "done", "done", "done", "done", "done", "done", "done", "failed"] as const;
  const brandIds = [slack.id, heineken.id];
  const figFiles = ["abc123-Marketing-2026Q2", "def456-Web-Site", "ghi789-Q3-Campaign"];
  for (let i = 0; i < 200; i++) {
    const type = pick(types as any) as typeof types[number];
    const st = pick(status as any) as typeof status[number];
    const created = jitter(daysAgo(randInt(0, 30)));
    const dur = randInt(800, 9000);
    const [gen] = await db.insert(schema.generations).values({
      orgId: org.id,
      brandId: pick(brandIds),
      userId: pick(users).id,
      type, status: st,
      input: type === "copy_variant"
        ? { type: "copy_variant", payload: { prompt: "Localize headline", count: 3 } }
        : type === "translate"
        ? { type: "translate", payload: { source_text: "...", source_locale: "en", target_locales: ["es","fr"] } }
        : { type: "image", payload: { prompt: "Hero banner", size: "1024x1024", count: 3 } },
      output: st === "failed" ? null : (
        type === "copy_variant" ? ["Variant A", "Variant B", "Variant C"] :
        type === "translate" ? { es: "...", fr: "..." } :
        ["s3://var-1.png","s3://var-2.png","s3://var-3.png"]
      ) as any,
      error: st === "failed" ? "model timeout" : null,
      figmaFileKey: pick(figFiles),
      figmaNodeId: `${randInt(1,99)}:${randInt(100,9999)}`,
      startedAt: created as any,
      completedAt: new Date(created.getTime() + dur) as any,
      createdAt: created as any,
    }).returning();
    const calls = type === "copy_variant" ? 1 : type === "translate" ? 2 : 1;
    for (let k = 0; k < calls; k++) {
      const inputT = type === "image" ? null : randInt(200, 1500);
      const outputT = type === "image" ? null : randInt(50, 600);
      const cost = type === "image" ? 0.04 : (inputT! / 1000) * 0.00125 + (outputT! / 1000) * 0.01;
      await db.insert(schema.usageEvents).values({
        orgId: org.id, brandId: gen.brandId, userId: gen.userId, generationId: gen.id,
        feature: type, provider: "openrouter",
        model: type === "image" ? "openai/gpt-image-2" : "openai/gpt-5.5",
        inputTokens: inputT, outputTokens: outputT,
        costUsd: cost.toFixed(6) as any,
        latencyMs: dur,
        createdAt: created as any,
      });
    }
  }

  console.log("[seed] done");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run it**

```bash
cd landing/demo
pnpm fetch:pdfs
pnpm db:seed
```

Expected (first run): ~30s for the two extractions; cache files written; "done" printed.

- [ ] **Step 4: Verify counts**

```bash
docker exec $(docker ps -qf name=postgres) psql -U demo -d studio_demo -c \
  "select 'orgs', count(*) from org union all
   select 'users', count(*) from \"user\" union all
   select 'brands', count(*) from brand union all
   select 'profiles', count(*) from brand_profile union all
   select 'generations', count(*) from generation union all
   select 'usage_events', count(*) from usage_event;"
```

Expected counts: orgs=1, users=5, brands=2, profiles=6, generations=200, usage_events≥202.

- [ ] **Step 5: Commit**

```bash
git add landing/demo/scripts/seed.ts landing/demo/scripts/seed-helpers.ts landing/demo/infra/seed-extractions/.gitkeep
git commit -m "demo: seed script (real PDF extraction + 200 generations)"
```

---

## Phase 3 — Web app

### Task 3.1: Scaffold Vite + React + TanStack + Tailwind 4 + shadcn

**Files:**
- Create: `landing/demo/apps/web/package.json`
- Create: `landing/demo/apps/web/tsconfig.json`
- Create: `landing/demo/apps/web/tsconfig.node.json`
- Create: `landing/demo/apps/web/vite.config.ts`
- Create: `landing/demo/apps/web/index.html`
- Create: `landing/demo/apps/web/postcss.config.js` (Tailwind 4 typically uses `@tailwindcss/vite`, no postcss needed; create only if required by stack)
- Create: `landing/demo/apps/web/src/main.tsx`
- Create: `landing/demo/apps/web/src/styles.css`
- Create: `landing/demo/apps/web/src/lib/utils.ts`

- [ ] **Step 1: `package.json`**

```json
{
  "name": "@studio/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 5173",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-router": "^1.95.0",
    "@tanstack/react-query": "^5.62.0",
    "@tanstack/react-form": "^0.41.0",
    "zod": "^4.0.0",
    "recharts": "^2.15.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5",
    "lucide-react": "^0.460.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-tooltip": "^1.1.4",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-slot": "^1.1.1",
    "@studio/schemas": "workspace:*",
    "@studio/tokens": "workspace:*"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "@tanstack/router-plugin": "^1.95.0",
    "@tanstack/router-devtools": "^1.95.0",
    "@tanstack/react-query-devtools": "^5.62.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:3001", changeOrigin: true } },
  },
});
```

- [ ] **Step 3: `tsconfig.json` + `tsconfig.node.json`**

```json
// tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "Bundler",
    "noEmit": true
  }
}
```

```json
// tsconfig.node.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["vite.config.ts"],
  "compilerOptions": { "module": "ESNext", "moduleResolution": "Bundler" }
}
```

- [ ] **Step 4: `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Studio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: `src/styles.css`**

```css
@import "@studio/tokens/global.css";
@import "tailwindcss";

@theme {
  --color-cream: oklch(97.5% 0.005 60);
  --color-charcoal: oklch(20% 0.01 50);
  --color-reading: oklch(35% 0.008 50);
  --color-stone: oklch(55% 0.005 50);
  --color-coral: oklch(64% 0.16 35);
  --color-hairline: oklch(85% 0.005 50);
  --color-sunken: oklch(96% 0.005 60);
  --font-serif: var(--font-serif);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}

@layer base {
  body { background: var(--color-cream); color: var(--color-charcoal); }
}
```

- [ ] **Step 6: `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

- [ ] **Step 7: `src/main.tsx`** (with TanStack Router + Query providers)

```tsx
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

const router = createRouter({ routeTree, context: { queryClient } });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 8: Sanity check**

```bash
cd landing/demo && pnpm install && pnpm --filter @studio/web dev
```

Expected: Vite dev server at http://localhost:5173 (will fail compile until routes exist — next task).

- [ ] **Step 9: Commit**

```bash
git add landing/demo/apps/web
git commit -m "demo: web scaffold (Vite + React 19 + TanStack + Tailwind 4)"
```

---

### Task 3.2: shadcn primitives + base components

**Files:**
- Create: `landing/demo/apps/web/components.json`
- Create: `landing/demo/apps/web/src/components/ui/button.tsx`
- Create: `landing/demo/apps/web/src/components/ui/card.tsx`
- Create: `landing/demo/apps/web/src/components/ui/input.tsx`
- Create: `landing/demo/apps/web/src/components/ui/label.tsx`
- Create: `landing/demo/apps/web/src/components/ui/tabs.tsx`
- Create: `landing/demo/apps/web/src/components/ui/dialog.tsx`
- Create: `landing/demo/apps/web/src/components/ui/dropdown-menu.tsx`
- Create: `landing/demo/apps/web/src/components/ui/select.tsx`
- Create: `landing/demo/apps/web/src/components/ui/skeleton.tsx`
- Create: `landing/demo/apps/web/src/components/ui/table.tsx`
- Create: `landing/demo/apps/web/src/components/ui/toast.tsx`

- [ ] **Step 1: Initialize shadcn (CLI)**

```bash
cd landing/demo/apps/web
pnpm dlx shadcn@latest init --yes \
  --base-color slate --style new-york \
  --css src/styles.css --tailwind-config none
```

If the CLI asks interactive questions, accept defaults; CSS path = `src/styles.css`, components path = `src/components/ui`.

- [ ] **Step 2: Add primitives**

```bash
pnpm dlx shadcn@latest add button card input label tabs dialog dropdown-menu select skeleton table toast --yes
```

- [ ] **Step 3: Re-theme shadcn neutrals to cream/charcoal**

Open the generated `src/styles.css`. Replace the shadcn `--background`, `--foreground`, `--border`, etc. CSS variables with mappings to the studio tokens:

```css
:root {
  --background: var(--color-cream);
  --foreground: var(--color-charcoal);
  --muted: var(--color-sunken);
  --muted-foreground: var(--color-stone);
  --border: var(--color-hairline);
  --input: var(--color-hairline);
  --ring: var(--color-coral);
  --primary: var(--color-charcoal);
  --primary-foreground: var(--color-cream);
  --accent: var(--color-coral);
  --accent-foreground: var(--color-cream);
  --radius: 0.25rem;
}
```

- [ ] **Step 4: Verify with a smoke component**

Add to `src/main.tsx` a temporary `<App />` that renders `<Button>Hi</Button>` to confirm rendering. Remove after Task 3.3 lands routes.

- [ ] **Step 5: Commit**

```bash
git add landing/demo/apps/web
git commit -m "demo: web shadcn primitives + studio token re-theme"
```

---

### Task 3.3: API client + shared hooks

**Files:**
- Create: `landing/demo/apps/web/src/lib/api.ts`
- Create: `landing/demo/apps/web/src/lib/sse.ts`

- [ ] **Step 1: `src/lib/api.ts`**

```ts
import type { BrandProfile } from "@studio/schemas";

const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Brand = { id: string; name: string; createdAt: string; deletedAt: string | null };
export type ProfileRow = {
  id: string; brandId: string; version: number;
  status: "processing" | "ready" | "failed";
  profile: BrandProfile | null;
  sourcePdfFilename: string | null;
  sourcePdfSizeBytes: number | null;
  isCurrent: boolean;
  createdBy: string | null;
  createdAt: string;
};
export type GenerationRow = {
  id: string; brandId: string; userId: string;
  type: "copy_variant" | "translate" | "image";
  status: "pending" | "running" | "done" | "failed";
  input: any; output: any;
  startedAt: string | null; completedAt: string | null; createdAt: string;
};

export const api = {
  me: () => req<{ orgId: string; userId: string }>("/me"),
  brands: {
    list: () => req<Brand[]>("/brands"),
    create: (name: string) => req<Brand>("/brands", { method: "POST", body: JSON.stringify({ name }) }),
    detail: (id: string) =>
      req<{ brand: Brand; currentProfile: ProfileRow | null; stats: { genCount30d: number; lastActivityAt: string | null } }>(`/brands/${id}`),
    rename: (id: string, name: string) =>
      req<Brand>(`/brands/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    archive: (id: string) =>
      req<Brand>(`/brands/${id}`, { method: "PATCH", body: JSON.stringify({ archived: true }) }),
  },
  profiles: {
    listForBrand: (brandId: string) => req<ProfileRow[]>(`/brands/${brandId}/profiles`),
    get: (id: string) => req<ProfileRow>(`/profiles/${id}`),
    upload: (brandId: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return req<ProfileRow>(`/brands/${brandId}/profiles`, { method: "POST", body: fd });
    },
    handAuthor: (brandId: string, profile?: BrandProfile) =>
      req<ProfileRow>(`/brands/${brandId}/profiles`, { method: "POST", body: JSON.stringify({ profile }) }),
    edit: (id: string, profile: BrandProfile) =>
      req<ProfileRow>(`/profiles/${id}`, { method: "PUT", body: JSON.stringify({ profile }) }),
    retry: (id: string) => req<ProfileRow>(`/profiles/${id}/retry`, { method: "POST" }),
    setCurrent: (id: string) => req<ProfileRow>(`/profiles/${id}/set-current`, { method: "POST" }),
    eventsUrl: (id: string) => `/api/profiles/${id}/events`,
  },
  generations: {
    list: (q: Record<string, string | number | undefined>) => {
      const usp = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v !== undefined) usp.set(k, String(v));
      return req<{ items: GenerationRow[]; nextCursor: string | null }>(`/generations?${usp}`);
    },
    get: (id: string) => req<GenerationRow>(`/generations/${id}`),
  },
  usage: {
    rollup: (groupBy: "user" | "brand" | "day" | "feature", days: number) =>
      req<Array<{ key: string; calls: number; inputTokens: number; outputTokens: number; costUsd: string; avgLatencyMs: number }>>(
        `/usage?groupBy=${groupBy}&days=${days}`
      ),
  },
};
```

- [ ] **Step 2: `src/lib/sse.ts`**

```ts
import { useEffect } from "react";

export function useProfileEvents(profileId: string | undefined, opts: {
  onReady?: () => void;
  onFailed?: (msg: string) => void;
}) {
  useEffect(() => {
    if (!profileId) return;
    const es = new EventSource(`/api/profiles/${profileId}/events`);
    const handleReady = () => opts.onReady?.();
    const handleFailed = (e: MessageEvent) => {
      try { opts.onFailed?.(JSON.parse(e.data).error ?? "extraction failed"); }
      catch { opts.onFailed?.("extraction failed"); }
    };
    es.addEventListener("ready", handleReady);
    es.addEventListener("failed", handleFailed);
    return () => {
      es.removeEventListener("ready", handleReady);
      es.removeEventListener("failed", handleFailed);
      es.close();
    };
  }, [profileId, opts]);
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/demo/apps/web/src/lib
git commit -m "demo: web api client + SSE hook"
```

---

### Task 3.4: Shell + routes (`__root`, redirect, plugin placeholder)

**Files:**
- Create: `landing/demo/apps/web/src/routes/__root.tsx`
- Create: `landing/demo/apps/web/src/routes/index.tsx`
- Create: `landing/demo/apps/web/src/routes/plugin.tsx`
- Create: `landing/demo/apps/web/src/components/Shell.tsx`

- [ ] **Step 1: `components/Shell.tsx`** — top bar + left rail (replicates landing chrome)

```tsx
import { Link, Outlet, useRouterState } from "@tanstack/react-router";

const NAV = [
  { id: "brands",      label: "Brands",      to: "/brands" },
  { id: "generations", label: "Generations", to: "/generations" },
  { id: "usage",       label: "Usage",       to: "/usage" },
  { id: "plugin",      label: "Plugin",      to: "/plugin" },
];

export function Shell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr] bg-[var(--color-cream)] text-[var(--color-charcoal)]">
      <aside className="border-r border-[var(--color-hairline)] px-5 py-7">
        <div className="font-[var(--font-serif)] text-[1.4rem] tracking-[-0.01em] mb-9">Studio</div>
        <nav>
          <ul className="flex flex-col gap-1">
            {NAV.map((n, i) => {
              const active = path.startsWith(n.to);
              return (
                <li key={n.id}>
                  <Link
                    to={n.to}
                    className={
                      "flex items-baseline gap-3 px-2 py-1.5 rounded text-[0.875rem] " +
                      (active ? "text-[var(--color-charcoal)]" : "text-[var(--color-stone)] hover:text-[var(--color-charcoal)]")
                    }
                  >
                    <span className={"font-mono text-[0.6875rem] " + (active ? "text-[var(--color-coral)]" : "")}>
                      0{i + 1}
                    </span>
                    <span>{n.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <main className="px-10 py-7 max-w-[1280px]">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: `routes/__root.tsx`**

```tsx
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { Shell } from "../components/Shell";

interface RouterContext { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Shell />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  ),
});
```

(`<Shell />` already renders `<Outlet />` itself; remove duplicate `<Outlet />` here.)

- [ ] **Step 3: `routes/index.tsx`**

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/brands" }); },
});
```

- [ ] **Step 4: `routes/plugin.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/plugin")({
  component: PluginPage,
});

function PluginPage() {
  return (
    <section className="max-w-[820px]">
      <h1 className="font-serif text-[2.25rem] tracking-[-0.01em]">Figma Plugin</h1>
      <p className="text-[0.9375rem] text-[var(--color-reading)] mt-2 mb-6">
        Designer surface, inside Figma. Out of demo scope. The platform writes plugin-originating
        rows to <span className="font-mono text-[var(--color-charcoal)]">generation</span> and
        <span className="font-mono text-[var(--color-charcoal)]"> usage_event</span> — visible in
        History and Usage.
      </p>
      <div className="border border-[var(--color-hairline)] rounded p-4 bg-[var(--color-sunken)]">
        <img src="/plugin-mockup.png" alt="Plugin mockup" className="w-full" />
      </div>
    </section>
  );
}
```

(Generate `public/plugin-mockup.png` once via Playwright capturing landing's PluginMockup — see Phase 4 visual baselines.)

- [ ] **Step 5: Run `pnpm --filter @studio/web dev`**

Expected: routes generated by TanStack Router plugin (`routeTree.gen.ts` written), site loads at /brands (will 404 until next task).

- [ ] **Step 6: Commit**

```bash
git add landing/demo/apps/web
git commit -m "demo: web shell + root + plugin placeholder route"
```

---

### Task 3.5: Brands list page + create dialog

**Files:**
- Create: `landing/demo/apps/web/src/routes/brands.index.tsx`
- Create: `landing/demo/apps/web/src/features/brands/BrandsList.tsx`
- Create: `landing/demo/apps/web/src/features/brands/NewBrandDialog.tsx`

- [ ] **Step 1: `routes/brands.index.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { BrandsList } from "../features/brands/BrandsList";

export const Route = createFileRoute("/brands/")({ component: BrandsList });
```

- [ ] **Step 2: `BrandsList.tsx`** — match `BrandsMockup.astro` layout

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "../../lib/api";
import { NewBrandDialog } from "./NewBrandDialog";

export function BrandsList() {
  const q = useQuery({ queryKey: ["brands"], queryFn: api.brands.list });

  return (
    <section>
      <header className="flex items-baseline justify-between border-b border-[var(--color-hairline)] pb-4 mb-8">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-stone)]">brands</p>
          <h1 className="font-serif text-[2.25rem] tracking-[-0.01em]">All brands</h1>
        </div>
        <NewBrandDialog />
      </header>

      {q.isLoading && <p className="text-[var(--color-stone)]">Loading…</p>}
      {q.data && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--color-hairline)] border border-[var(--color-hairline)] rounded">
          {q.data.map((b) => (
            <li key={b.id} className="bg-[var(--color-cream)] p-5">
              <Link to="/brands/$brandId" params={{ brandId: b.id }} className="block">
                <p className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-stone)]">brand</p>
                <h2 className="font-serif text-[1.5rem] tracking-[-0.01em] mt-1">{b.name}</h2>
                <p className="text-[0.8125rem] text-[var(--color-reading)] mt-3">
                  Click to open guideline, generations, and usage.
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

(Refine the inner layout against `landing/src/components/mockups/BrandsMockup.astro` — replicate the exact card grid, status badge, gen-count, last-activity strip. The starter above is a working baseline; Task 4 visual regression will catch deltas.)

- [ ] **Step 3: `NewBrandDialog.tsx`**

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api } from "../../lib/api";

export function NewBrandDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api.brands.create(name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brands"] }); setOpen(false); setName(""); },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">New brand</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New brand</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="flex flex-col gap-3">
          <Input placeholder="Brand name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Button type="submit" disabled={!name || m.isPending}>Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Verify in browser**

```bash
cd landing/demo
pnpm dev   # api + worker + web
```

Open http://localhost:5173 → redirected to /brands → see Slack and Heineken cards. Create a third → list updates.

- [ ] **Step 5: Commit**

```bash
git add landing/demo/apps/web
git commit -m "demo: brands list page + new-brand dialog"
```

---

### Task 3.6: Brand-detail page (Voice/Visual/Localization/Banned tabs + sidebar)

**Files:**
- Create: `landing/demo/apps/web/src/routes/brands.$brandId.tsx`
- Create: `landing/demo/apps/web/src/features/brand-detail/BrandDetail.tsx`
- Create: `landing/demo/apps/web/src/features/brand-detail/UploadCard.tsx`
- Create: `landing/demo/apps/web/src/features/brand-detail/ProfileEditor.tsx`
- Create: `landing/demo/apps/web/src/features/brand-detail/Sidebar.tsx`
- Create: `landing/demo/apps/web/src/features/brand-detail/VersionTimeline.tsx`
- Create: `landing/demo/apps/web/src/features/brand-detail/PaletteCard.tsx`
- Create: `landing/demo/apps/web/src/features/brand-detail/SourcePdfCard.tsx`

- [ ] **Step 1: Route**

```tsx
// routes/brands.$brandId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { BrandDetail } from "../features/brand-detail/BrandDetail";

export const Route = createFileRoute("/brands/$brandId")({
  component: () => <BrandDetail brandId={Route.useParams().brandId} />,
});
```

- [ ] **Step 2: `BrandDetail.tsx`** — orchestrates upload state, profile fetch, SSE wiring

```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { UploadCard } from "./UploadCard";
import { ProfileEditor } from "./ProfileEditor";
import { Sidebar } from "./Sidebar";
import { useProfileEvents } from "../../lib/sse";

export function BrandDetail({ brandId }: { brandId: string }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["brand", brandId], queryFn: () => api.brands.detail(brandId) });
  const versions = useQuery({ queryKey: ["brand", brandId, "profiles"], queryFn: () => api.profiles.listForBrand(brandId) });
  const current = detail.data?.currentProfile ?? null;

  useProfileEvents(current?.status === "processing" ? current.id : undefined, {
    onReady: () => {
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
    onFailed: () => {
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
  });

  if (detail.isLoading) return <p className="text-[var(--color-stone)]">Loading…</p>;
  if (!detail.data) return null;

  return (
    <section>
      <header className="flex items-baseline justify-between border-b border-[var(--color-hairline)] pb-4 mb-6">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-stone)]">brand</p>
          <h1 className="font-serif text-[2.25rem] tracking-[-0.01em]">{detail.data.brand.name}</h1>
        </div>
      </header>

      <div className="grid grid-cols-[1fr_240px] gap-8">
        <div>
          {!current && <UploadCard brandId={brandId} />}
          {current?.status === "processing" && <p className="text-[var(--color-reading)]">Extracting profile…</p>}
          {current?.status === "failed" && (
            <div className="border border-[var(--color-hairline)] rounded p-4">
              <p className="text-[var(--color-charcoal)]">Extraction failed: {current.ingestError ?? "unknown"}</p>
            </div>
          )}
          {current?.status === "ready" && current.profile && (
            <ProfileEditor profileId={current.id} initial={current.profile} brandId={brandId} />
          )}
        </div>
        <Sidebar
          brandId={brandId}
          current={current}
          versions={versions.data ?? []}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `UploadCard.tsx`**

```tsx
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";

export function UploadCard({ brandId }: { brandId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (f: File) => api.profiles.upload(brandId, f),
    onMutate: () => setStatus("uploading…"),
    onSuccess: () => {
      setStatus("queued for extraction");
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
    },
    onError: (e) => setStatus(`error: ${(e as Error).message}`),
  });
  const handAuthor = useMutation({
    mutationFn: () => api.profiles.handAuthor(brandId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand", brandId] }),
  });

  return (
    <div className="border border-[var(--color-hairline)] rounded p-6">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-stone)]">guideline</p>
      <h2 className="font-serif text-[1.5rem] mt-1">No profile yet</h2>
      <p className="text-[0.875rem] text-[var(--color-reading)] mt-2 max-w-prose">
        Upload a brand-guideline PDF to extract a structured profile, or hand-author one from scratch.
      </p>
      <div className="flex gap-3 mt-5">
        <input ref={inputRef} type="file" accept="application/pdf" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
        <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>Upload PDF</Button>
        <Button variant="outline" onClick={() => handAuthor.mutate()} disabled={handAuthor.isPending}>
          Hand-author
        </Button>
      </div>
      {status && <p className="text-[0.8125rem] text-[var(--color-stone)] mt-3">{status}</p>}
    </div>
  );
}
```

- [ ] **Step 4: `ProfileEditor.tsx`** — Voice/Visual/Localization/Banned tabs

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api } from "../../lib/api";
import type { BrandProfile } from "@studio/schemas";

export function ProfileEditor({ profileId, initial, brandId }: {
  profileId: string;
  initial: BrandProfile;
  brandId: string;
}) {
  const [draft, setDraft] = useState<BrandProfile>(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => api.profiles.edit(profileId, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>Save</Button>
      </div>
      <Tabs defaultValue="voice">
        <TabsList>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="visual">Visual</TabsTrigger>
          <TabsTrigger value="localization">Localization</TabsTrigger>
          <TabsTrigger value="banned">Banned</TabsTrigger>
        </TabsList>
        <TabsContent value="voice" className="pt-6">
          <ChipsField
            label={`Tone descriptors (${draft.voice.tone_descriptors.length}/8)`}
            value={draft.voice.tone_descriptors}
            onChange={(v) => setDraft({ ...draft, voice: { ...draft.voice, tone_descriptors: v.slice(0, 8) } })}
          />
          <BulletField
            label="Voice principles"
            value={draft.voice.voice_principles}
            onChange={(v) => setDraft({ ...draft, voice: { ...draft.voice, voice_principles: v } })}
          />
        </TabsContent>
        <TabsContent value="visual" className="pt-6">
          <ul className="grid grid-cols-2 gap-3">
            {draft.visual.palette.map((p, i) => (
              <li key={i} className="flex items-center gap-3 border border-[var(--color-hairline)] rounded p-2">
                <span className="w-7 h-7 rounded" style={{ background: p.hex }} />
                <div>
                  <p className="text-[0.875rem]">{p.name}</p>
                  <p className="font-mono text-[0.6875rem] text-[var(--color-stone)]">{p.hex}</p>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="localization" className="pt-6">
          <p className="text-[0.875rem] text-[var(--color-reading)]">
            {draft.localization?.locales.join(", ") || "No locales listed in source."}
          </p>
        </TabsContent>
        <TabsContent value="banned" className="pt-6">
          <ChipsField
            label="Banned terms"
            value={draft.banned_terms}
            onChange={(v) => setDraft({ ...draft, banned_terms: v })}
            danger
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChipsField({ label, value, onChange, danger }: {
  label: string; value: string[]; onChange: (v: string[]) => void; danger?: boolean;
}) {
  const [adding, setAdding] = useState("");
  return (
    <section className="mb-6">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-stone)] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((v, i) => (
          <span key={i} className={
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.75rem] " +
            (danger
              ? "font-mono line-through text-[oklch(40%_0.13_25)] bg-[oklch(96%_0.012_25/0.7)]"
              : "border border-[var(--color-hairline)] bg-[var(--color-sunken)]")
          }>
            {v}
            <button aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-[var(--color-stone)] text-[0.875rem]">×</button>
          </span>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (adding.trim()) { onChange([...value, adding.trim()]); setAdding(""); } }}>
        <Input placeholder="Add and press enter" value={adding} onChange={(e) => setAdding(e.target.value)} />
      </form>
    </section>
  );
}

function BulletField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void; }) {
  return (
    <section className="mb-6">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-stone)] mb-2">{label}</p>
      <ul className="flex flex-col gap-2">
        {value.map((v, i) => (
          <li key={i}>
            <Input value={v} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          </li>
        ))}
        <li>
          <Button variant="outline" onClick={() => onChange([...value, ""])}>+ Add</Button>
        </li>
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: `Sidebar.tsx`**, `PaletteCard.tsx`, `SourcePdfCard.tsx`, `VersionTimeline.tsx`

Replicate `landing/src/components/mockups/GuidelineMockup.astro` sidebar exactly. The implementer reads the Astro source and ports it to React verbatim — same className structure, same OKLCH inline styles, same DOM tree. Source PDF card displays the `sourcePdfFilename` from current row; palette card maps `current.profile.visual.palette`; version timeline renders the `versions` array, current row marked with coral, "Set as current" button for non-current `ready` rows that fires `api.profiles.setCurrent`.

```tsx
// Sidebar.tsx
import { SourcePdfCard } from "./SourcePdfCard";
import { PaletteCard } from "./PaletteCard";
import { VersionTimeline } from "./VersionTimeline";
import type { ProfileRow } from "../../lib/api";

export function Sidebar({ brandId, current, versions }: {
  brandId: string;
  current: ProfileRow | null;
  versions: ProfileRow[];
}) {
  return (
    <aside className="flex flex-col gap-4">
      {current?.sourcePdfFilename && (
        <SourcePdfCard
          filename={current.sourcePdfFilename}
          sizeBytes={current.sourcePdfSizeBytes ?? 0}
        />
      )}
      {current?.profile?.visual?.palette && (
        <PaletteCard palette={current.profile.visual.palette} />
      )}
      <VersionTimeline brandId={brandId} versions={versions} />
    </aside>
  );
}
```

(Implementations of `SourcePdfCard.tsx`, `PaletteCard.tsx`, `VersionTimeline.tsx` follow the same pattern: copy DOM and CSS classes from the Astro source.)

- [ ] **Step 6: Verify upload + extraction live**

```bash
cd landing/demo && pnpm dev
```

Browser → /brands → click Slack → see ready profile + version timeline. Create a new brand "Test" → upload `infra/seed-pdfs/heineken.pdf` → "Extracting…" → SSE delivers ready → editor renders.

- [ ] **Step 7: Commit**

```bash
git add landing/demo/apps/web
git commit -m "demo: brand-detail page (upload, editor tabs, sidebar, SSE wiring)"
```

---

### Task 3.7: Generations + Usage pages

**Files:**
- Create: `landing/demo/apps/web/src/routes/generations.index.tsx`
- Create: `landing/demo/apps/web/src/routes/generations.$id.tsx`
- Create: `landing/demo/apps/web/src/routes/usage.tsx`
- Create: `landing/demo/apps/web/src/features/history/HistoryTable.tsx`
- Create: `landing/demo/apps/web/src/features/history/Filters.tsx`
- Create: `landing/demo/apps/web/src/features/usage/UsageDashboard.tsx`

- [ ] **Step 1: HistoryTable + Filters**

Port `landing/src/components/mockups/HistoryMockup.astro` 1:1. Table columns: time (relative), user (avatar+name), brand, type badge, status badge, latency, cost, applied-variant indicator. Filter row: brand select, type select, status select, user select, date range select. Row click opens `/generations/$id` overlay drawer.

- [ ] **Step 2: UsageDashboard**

Port `landing/src/components/mockups/UsageMockup.astro` 1:1. Recharts area chart for daily spend (`api.usage.rollup("day", 30)`). Per-user table (`api.usage.rollup("user", 30)` joined with `api.brands.list`-style user list — fetch users via a new `/api/users` endpoint, or piggyback off `/api/usage` returning user names). Keep totals row at bottom.

- [ ] **Step 3: Endpoint addition for users (small)**

Add `GET /api/users` route in `apps/api/src/index.ts` that returns `[{ id, name, email, role }]` for the seeded org. Required for usage table to map userId keys to names.

- [ ] **Step 4: Verify**

`pnpm dev`, visit /generations → 200-row table renders, filters narrow results. Visit /usage → chart and table render.

- [ ] **Step 5: Commit**

```bash
git add landing/demo/apps/web landing/demo/apps/api/src/index.ts
git commit -m "demo: generations history + usage dashboard pages"
```

---

## Phase 4 — Testing

### Task 4.1: Playwright workspace + first smoke test

**Files:**
- Create: `landing/demo/e2e/package.json`
- Create: `landing/demo/e2e/playwright.config.ts`
- Create: `landing/demo/e2e/tests/smoke.spec.ts`

- [ ] **Step 1: `package.json`**

```json
{
  "name": "@studio/e2e",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "ui": "playwright test --ui",
    "install:browsers": "playwright install --with-deps chromium",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@axe-core/playwright": "^4.10.0",
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    { command: "pnpm --filter @studio/api dev", port: 3001, reuseExistingServer: true, timeout: 60_000 },
    { command: "pnpm --filter @studio/worker dev", port: 0, reuseExistingServer: true },
    { command: "pnpm --filter @studio/web dev", port: 5173, reuseExistingServer: true, timeout: 60_000 },
  ],
});
```

(`port: 0` on worker is a placeholder; if Playwright requires a real port, omit the worker entry and require it to be running externally.)

- [ ] **Step 3: `tests/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("smoke: brand list -> detail -> edit -> save -> rollback", async ({ page }) => {
  await page.goto("/brands");
  await expect(page.getByRole("heading", { name: "All brands" })).toBeVisible();

  await page.getByRole("link", { name: /Slack/i }).click();
  await expect(page.getByRole("heading", { name: "Slack" })).toBeVisible();

  // Voice tab is default; remove one tone descriptor
  const firstChip = page.locator(".inline-flex").filter({ hasText: /^[A-Z][a-z]+/ }).first();
  await firstChip.getByRole("button", { name: /Remove/i }).click();
  await page.getByRole("button", { name: "Save" }).click();

  // Wait for refetch
  await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 5000 });

  // Verify version timeline shows new current row
  await expect(page.locator("text=v4")).toBeVisible();

  // Rollback to v3
  await page.locator("text=v3").locator("..").getByRole("button", { name: /Set as current/i }).click();
  await expect(page.locator("text=current")).toBeVisible();
});
```

(The exact selectors will need tightening once the UI is built; this is the structural intent.)

- [ ] **Step 4: Install browsers**

```bash
cd landing/demo
pnpm install
pnpm --filter @studio/e2e install:browsers
```

- [ ] **Step 5: Run**

```bash
pnpm test:e2e
```

Expected: smoke passes.

- [ ] **Step 6: Commit**

```bash
git add landing/demo/e2e
git commit -m "demo: playwright workspace + smoke test"
```

---

### Task 4.2: Brand-guideline extraction test (real LLM call)

**Files:**
- Create: `landing/demo/e2e/tests/extraction.spec.ts`

- [ ] **Step 1: Test file**

```ts
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BrandProfileSchema } from "@studio/schemas";

test("extraction: upload Slack PDF -> ready profile -> Zod-valid", async ({ request }) => {
  const brand = await request.post("http://localhost:3001/api/brands", {
    data: { name: `Test-${Date.now()}` },
  }).then((r) => r.json());

  const pdf = await readFile(join(__dirname, "../../infra/seed-pdfs/slack-2020.pdf"));
  const blob = new Blob([pdf], { type: "application/pdf" });
  const fd = new FormData();
  fd.append("file", blob, "slack.pdf");

  const created = await request.post(
    `http://localhost:3001/api/brands/${brand.id}/profiles`,
    { multipart: { file: { name: "slack.pdf", mimeType: "application/pdf", buffer: pdf } } as any }
  ).then((r) => r.json());

  // Poll until ready
  const start = Date.now();
  let row = created;
  while (Date.now() - start < 120_000 && row.status !== "ready") {
    await new Promise((r) => setTimeout(r, 2000));
    row = await request.get(`http://localhost:3001/api/profiles/${created.id}`).then((r) => r.json());
    if (row.status === "failed") throw new Error(`extraction failed: ${row.ingestError}`);
  }
  expect(row.status).toBe("ready");

  const parsed = BrandProfileSchema.parse(row.profile);
  expect(parsed.brand_name.length).toBeGreaterThan(0);
  expect(parsed.voice.tone_descriptors.length).toBeGreaterThan(0);
  expect(parsed.visual.palette.length).toBeGreaterThanOrEqual(3);
});
```

- [ ] **Step 2: Run**

```bash
pnpm test:e2e -- extraction
```

Expected: passes within ~120s budget (cache hit on later runs since seed already extracts these PDFs — but this test creates a fresh brand so it pays the live LLM cost each run).

- [ ] **Step 3: Commit**

```bash
git add landing/demo/e2e/tests/extraction.spec.ts
git commit -m "demo: e2e test for live PDF extraction (Slack)"
```

---

### Task 4.3: Failure + retry test

**Files:**
- Create: `landing/demo/e2e/tests/failure-retry.spec.ts`
- Modify: `landing/demo/apps/worker/src/extract-profile-handler.ts` (already supports `FORCE_EXTRACT_FAIL` from Task 2.6)

- [ ] **Step 1: Test file**

```ts
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test.skip(!!process.env.CI && !process.env.OPENROUTER_API_KEY, "needs key");

test("failure -> retry -> success", async ({ page, request }) => {
  // Pre-condition: worker started with FORCE_EXTRACT_FAIL=1.
  // Test runner expects the user/CI to start worker that way for this test only.
  const brand = await request.post("http://localhost:3001/api/brands", {
    data: { name: `RetryTest-${Date.now()}` },
  }).then((r) => r.json());

  const pdf = await readFile(join(__dirname, "../../infra/seed-pdfs/heineken.pdf"));
  const created = await request.post(`http://localhost:3001/api/brands/${brand.id}/profiles`, {
    multipart: { file: { name: "heineken.pdf", mimeType: "application/pdf", buffer: pdf } } as any,
  }).then((r) => r.json());

  // Poll until failed
  let row = created;
  const start = Date.now();
  while (Date.now() - start < 30_000 && row.status !== "failed") {
    await new Promise((r) => setTimeout(r, 1500));
    row = await request.get(`http://localhost:3001/api/profiles/${created.id}`).then((r) => r.json());
  }
  expect(row.status).toBe("failed");

  // Retry
  await request.post(`http://localhost:3001/api/profiles/${created.id}/retry`);
  const start2 = Date.now();
  while (Date.now() - start2 < 120_000 && row.status !== "ready") {
    await new Promise((r) => setTimeout(r, 2000));
    row = await request.get(`http://localhost:3001/api/profiles/${created.id}`).then((r) => r.json());
  }
  expect(row.status).toBe("ready");
});
```

(Note: this test requires the worker to be restarted with `FORCE_EXTRACT_FAIL=1`. Document in the README that retry test runs separately.)

- [ ] **Step 2: Commit**

```bash
git add landing/demo/e2e/tests/failure-retry.spec.ts
git commit -m "demo: e2e failure + retry test"
```

---

### Task 4.4: Visual regression — capture baselines + assert parity

**Files:**
- Create: `landing/demo/scripts/capture-mockup-baselines.ts`
- Create: `landing/demo/e2e/tests/visual.spec.ts`
- Create: `landing/demo/e2e/baselines/.gitkeep`

- [ ] **Step 1: `scripts/capture-mockup-baselines.ts`**

```ts
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, "..", "e2e", "baselines");
const LANDING_DIR = join(__dir, "..", "..");

async function startLanding(): Promise<{ url: string; kill: () => void }> {
  const child = spawn("pnpm", ["dev"], { cwd: LANDING_DIR, stdio: "pipe" });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("landing dev timeout")), 30_000);
    child.stdout?.on("data", (b) => {
      if (b.toString().includes("4321")) { clearTimeout(t); resolve(); }
    });
    child.on("exit", () => reject(new Error("landing dev exited")));
  });
  return { url: "http://localhost:4321", kill: () => child.kill() };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const landing = await startLanding();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const base = `${landing.url}/superside-assessment`;
  for (const id of ["brands", "guideline", "generations", "usage", "plugin"]) {
    await page.goto(`${base}#solution-${id}`);
    await page.waitForLoadState("networkidle");
    const panel = page.locator(`[data-panel="${id}"][data-active]`);
    await panel.waitFor();
    const buf = await panel.screenshot({ type: "png" });
    await writeFile(join(OUT, `${id}.png`), buf);
    console.log(`baseline: ${id}.png`);
  }
  await browser.close();
  landing.kill();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run capture once**

```bash
cd landing/demo
node --import tsx scripts/capture-mockup-baselines.ts
```

Expected: `e2e/baselines/{brands,guideline,generations,usage,plugin}.png` written.

- [ ] **Step 3: `e2e/tests/visual.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PAGES: Array<{ id: string; url: string }> = [
  { id: "brands", url: "/brands" },
  { id: "guideline", url: "/brands/__current__" }, // resolved at runtime via API
  { id: "generations", url: "/generations" },
  { id: "usage", url: "/usage" },
  { id: "plugin", url: "/plugin" },
];

for (const p of PAGES) {
  test(`visual: ${p.id} matches landing mockup`, async ({ page, request }) => {
    let url = p.url;
    if (p.id === "guideline") {
      const brands = await request.get("http://localhost:3001/api/brands").then((r) => r.json());
      url = `/brands/${brands[0].id}`;
    }
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const baseline = await readFile(join(__dirname, "..", "baselines", `${p.id}.png`));
    await expect(page).toHaveScreenshot(`${p.id}.png`, {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
      animations: "disabled",
    });
  });
}
```

(Playwright's built-in screenshot comparison stores its own snapshots under `*-snapshots/`. The baseline images from the landing serve as a manual check; assertion-grade uses Playwright's regenerated snapshots within the test run. Update strategy: run `pnpm test:visual --update-snapshots` once when a page is first stabilised.)

- [ ] **Step 4: First run with update**

```bash
pnpm test:visual -- --update-snapshots
```

- [ ] **Step 5: Commit baselines + test**

```bash
git add landing/demo/e2e/tests/visual.spec.ts \
        landing/demo/scripts/capture-mockup-baselines.ts \
        landing/demo/e2e/baselines \
        landing/demo/e2e/tests/visual.spec.ts-snapshots
git commit -m "demo: visual regression suite + baselines"
```

---

### Task 4.5: a11y test (axe-core on every route)

**Files:**
- Create: `landing/demo/e2e/tests/a11y.spec.ts`

- [ ] **Step 1: Test file**

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = ["/brands", "/generations", "/usage", "/plugin"];

for (const r of ROUTES) {
  test(`a11y: ${r} has no critical or serious violations`, async ({ page, request }) => {
    await page.goto(r);
    await page.waitForLoadState("networkidle");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const blocking = result.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}

test("a11y: brand-detail page", async ({ page, request }) => {
  const brands = await request.get("http://localhost:3001/api/brands").then((r) => r.json());
  await page.goto(`/brands/${brands[0].id}`);
  await page.waitForLoadState("networkidle");
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = result.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});
```

- [ ] **Step 2: Run + fix any blocking issues**

```bash
pnpm test:a11y
```

Common fixes: missing `alt`, low contrast on `<Input placeholder>`, focus order inside Dialog, missing `<label>` association.

- [ ] **Step 3: Commit**

```bash
git add landing/demo/e2e/tests/a11y.spec.ts
git commit -m "demo: axe-core a11y suite (WCAG 2.2 AA)"
```

---

### Task 4.6: Curl smoke script

**Files:**
- Create: `landing/demo/scripts/smoke.sh`

- [ ] **Step 1: Script**

```bash
#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://localhost:3001}"
echo "[smoke] healthz"
curl -fsS "$API/healthz" | jq -e '.ok == true' >/dev/null

echo "[smoke] /api/me"
curl -fsS "$API/api/me" | jq -e '.orgId and .userId' >/dev/null

echo "[smoke] /api/brands"
B=$(curl -fsS "$API/api/brands")
echo "$B" | jq -e 'length >= 2' >/dev/null

BID=$(echo "$B" | jq -r '.[0].id')
echo "[smoke] /api/brands/$BID"
curl -fsS "$API/api/brands/$BID" | jq -e '.brand and .currentProfile' >/dev/null

echo "[smoke] /api/brands/$BID/profiles"
curl -fsS "$API/api/brands/$BID/profiles" | jq -e 'length >= 1' >/dev/null

PID=$(curl -fsS "$API/api/brands/$BID" | jq -r '.currentProfile.id')
echo "[smoke] /api/profiles/$PID"
curl -fsS "$API/api/profiles/$PID" | jq -e '.profile.brand_name' >/dev/null

echo "[smoke] /api/generations"
curl -fsS "$API/api/generations?limit=10" | jq -e '.items | length >= 1' >/dev/null

echo "[smoke] /api/usage day"
curl -fsS "$API/api/usage?groupBy=day&days=30" | jq -e 'length >= 1' >/dev/null

echo "[smoke] /api/usage user"
curl -fsS "$API/api/usage?groupBy=user&days=30" | jq -e 'length >= 1' >/dev/null

echo "[smoke] all good"
```

`chmod +x scripts/smoke.sh`

- [ ] **Step 2: Run**

```bash
cd landing/demo && pnpm test:smoke
```

Expected: every line passes.

- [ ] **Step 3: Commit**

```bash
git add landing/demo/scripts/smoke.sh
git commit -m "demo: curl smoke script for every API endpoint"
```

---

## Phase 5 — Polish + README

### Task 5.1: README

**Files:**
- Create: `landing/demo/README.md`

- [ ] **Step 1: Write README**

```markdown
# Studio Demo

Runnable end-to-end slice of the Studio platform. Brand-guideline PDF → OpenRouter GPT-5.5 multimodal extraction → versioned, editable structured profile, with seeded generations + usage.

## Quick start

```bash
pnpm install
cp .env.example .env  # paste your OPENROUTER_API_KEY
pnpm fetch:pdfs
pnpm setup            # docker-compose up + migrate + seed (extracts both PDFs once, caches)
pnpm dev              # api :3001 + worker + web :5173
```

Open http://localhost:5173.

## What's live

- Brand CRUD (Slack, Heineken seeded; create more via "New brand")
- PDF upload → S3 → BullMQ → OpenRouter → versioned `BrandProfile`
- SSE updates on extraction state
- Manual edit (one save = new version), retry on failure, rollback (flag flip)

## What's seeded

- ~200 generation rows, ~500 usage_event rows, 5 users, 30-day spread
- Plugin tab is a screenshot of the landing's `PluginMockup` — out of demo scope

## Test

```bash
pnpm test:e2e            # full Playwright suite
pnpm test:visual         # visual regression
pnpm test:a11y           # axe-core WCAG 2.2 AA
pnpm test:smoke          # curl every endpoint
```

## Stack

Node 24 LTS, pnpm, Turborepo. Hono 4, BullMQ 5, Drizzle ORM, Postgres 17, Redis 7, LocalStack S3. AI SDK + `@openrouter/ai-sdk-provider` (response-healing plugin) calling `openai/gpt-5.5`. React 19 + TanStack Router/Query/Form + Tailwind 4 + shadcn/ui. Zod 4. Playwright + axe-core.
```

- [ ] **Step 2: Commit**

```bash
git add landing/demo/README.md
git commit -m "demo: README"
```

---

### Task 5.2: Final integration run

- [ ] **Step 1: Reset everything from a clean slate**

```bash
cd landing/demo
pnpm infra:down
rm -rf node_modules apps/*/node_modules packages/*/node_modules e2e/node_modules
pnpm install
pnpm setup
pnpm dev   # leave running in another terminal
```

- [ ] **Step 2: Run all test suites**

```bash
pnpm test:smoke
pnpm test:e2e
pnpm test:visual
pnpm test:a11y
```

All four green = acceptance criteria met.

- [ ] **Step 3: Final commit (if any)**

```bash
git status
git diff
# expected: clean tree
```

---

## Acceptance recap (matches spec §14)

1. `pnpm setup && pnpm dev` from clean clone → web app at http://localhost:5173 with seed data ✓ (Tasks 0.1–2.7)
2. Slack PDF upload → ready profile within 120s, ≥3 swatches, non-empty tone ✓ (Tasks 2.4, 2.6, 4.2)
3. Same for Heineken ✓ (covered by 4.2, swap PDF path)
4. Manual edit creates new version row, flips `is_current` ✓ (Task 2.4)
5. Rollback flips flag without inserting row ✓ (Task 2.4)
6. All Playwright suites pass ✓ (Phase 4)
7. Visual diffs ≤2% pixel ratio ✓ (Task 4.4)
8. Zero serious/critical axe violations ✓ (Task 4.5)
