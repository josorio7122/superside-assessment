# Engineering Conventions

How the codebase is organized, what libraries we use, and the rules we follow when writing it. Locked decisions; not aspirational.

## Stack

### Runtime / language

| Concern | Choice |
|---------|--------|
| Language | TypeScript (strict) |
| Node | Latest LTS |
| Package manager | pnpm |
| Monorepo orchestrator | Turborepo |
| Container | Docker (dev + prod parity) |

### Backend

| Concern | Choice |
|---------|--------|
| API framework | Hono |
| Validation | Zod (v4) — shared between API, web, and worker |
| ORM | Drizzle (Postgres) |
| Database | Postgres (latest) |
| Job queue | BullMQ over Redis (or Valkey) |
| Object store | S3 (or compatible) |
| Logging | pino (JSON, structured) |
| Env management | `t3-env` (typed env via zod) |
| AI / LLM client | Vercel AI SDK (`ai` package) — provider-agnostic, native streaming, `generateObject` for structured outputs |

### Frontend (admin web)

| Concern | Choice |
|---------|--------|
| Framework | React + Vite |
| Styling | Tailwind 4 |
| Components | shadcn/ui (Radix under the hood) |
| Routing | TanStack Router |
| Server state / data | TanStack Query |
| Forms | TanStack Form + Zod |
| Animations | framer-motion |
| Charts | Recharts (via shadcn `<Chart>` wrapper) |
| HTTP client | native `fetch` wrapped in a thin authed client |

### Tooling

| Concern | Choice |
|---------|--------|
| Lint + format | Biome (replaces ESLint + Prettier) |
| Tests | Vitest (everything) |
| Git hooks | None for MVP |
| Error tracking | None for MVP (no Sentry) |

### Models (already locked in `tooling.md`)

| Concern | Choice |
|---------|--------|
| Text + translation | OpenAI GPT-5.1. No fallback. |
| Image generation | OpenAI `gpt-image-2`. No fallback. |
| PDF extraction | OpenAI GPT-5.1 multimodal |

## Monorepo layout

```
apps/
  api/             Hono backend
  web/             Admin web (React + Vite + TanStack)
  worker/          BullMQ workers (image gen, profile extraction, cleanup)
  plugin/          Figma plugin (folder reserved; design deferred)

packages/
  db/              Drizzle schema + client + migrations
  shared/          Zod schemas, shared types, Result helpers, env config
  ai/              AI SDK wrappers, provider config, prompt assembly
  ui/              shadcn components shared between web and plugin UI

config/
  biome/           biome.jsonc shared base
  tsconfig/        base + per-package extends
```

Single `pnpm-workspace.yaml`. Single `turbo.json` defines `dev`, `build`, `lint`, `test`, `typecheck` pipelines.

### Sharing rules

- Cross-app types and Zod schemas live in `packages/shared`. Imported by both API and web.
- DB schema lives in `packages/db`. Imported only by API and worker. Frontend never imports `db`.
- AI SDK wrappers and prompt builders live in `packages/ai`. Imported by API and worker.
- shadcn components shared between web and plugin UI live in `packages/ui`.

## API folder pattern

One folder per entity. Folder name is singular kebab-case. No prefix on filenames.

```
apps/api/src/<entity>/
  router.ts          Hono route definitions
  validator.ts       zValidator middlewares (schemas re-exported from packages/shared)
  service.ts         business logic; if none, this file is one-line re-exports
  repository.ts      Drizzle calls; always returns Result
  types.ts           entity-local types (cross-entity types go to packages/shared)
  index.ts           re-exports the router for the app's root composer
```

Entities (initial set):

| Folder | Covers |
|--------|--------|
| `org/` | tenant root |
| `user/` | identity, JIT provisioning |
| `auth/` | WorkOS handoff, callback, sign-out |
| `brand/` | brand CRUD |
| `brand-profile/` | guideline upload, extraction, versions, rollback, SSE |
| `generation/` | copy-variant, translate, image, history, SSE |
| `usage/` | per-user dashboard, time-series queries |

## Layered rules

### Repository

- Always returns `Result<T, RepoError>`.
- One `safeExecuteAsync` wrapping the Drizzle call.
- No try/catch outside `safeExecuteAsync`.
- No business logic — only data access.
- `RepoError` is a discriminated union per entity (e.g. `{ kind: 'db_error' } | { kind: 'not_found' }`).

### Service

- If there's business logic, returns `Result<T, ServiceError>`.
- If there's none, the service file is a thin re-export:
  ```ts
  export const listBrands = brandRepository.listActive
  ```
- Service unwraps repository Results internally; if it can't recover, it converts to `ServiceError` and returns `err(...)`.
- No try/catch in services. Errors flow as Results.

### Router

- The only layer that converts `Result` to HTTP.
- Always unwraps the service Result.
- One concise pattern per endpoint:
  ```ts
  const result = await brandService.getById(id)
  if (!result.ok) {
    if (result.error.kind === 'not_found') return c.json({ error: 'not_found' }, 404)
    return c.json({ error: 'internal' }, 500)
  }
  return c.json(result.value)
  ```
- No business logic in the router — just request shape, validation invocation, service call, response shaping.

### Validator

- Zod schemas live in `packages/shared` so the web app can reuse them.
- The validator file in each entity wires schemas into Hono via `@hono/zod-validator`.

## Result type

Hand-rolled, minimal. Lives in `packages/shared/src/result.ts`. No external library (rejected `neverthrow` as overkill).

```ts
export type Ok<T>  = { ok: true;  value: T }
export type Err<E> = { ok: false; error: E }
export type Result<T, E = Error> = Ok<T> | Err<E>

export const ok  = <T>(value: T): Ok<T>  => ({ ok: true,  value })
export const err = <E>(error: E): Err<E> => ({ ok: false, error })

export const safeExecute = <T, E = Error>(
  fn: () => T,
  mapErr?: (e: unknown) => E,
): Result<T, E> => {
  try { return ok(fn()) }
  catch (e) { return err((mapErr ? mapErr(e) : (e as E))) }
}

export const safeExecuteAsync = async <T, E = Error>(
  fn: () => Promise<T>,
  mapErr?: (e: unknown) => E,
): Promise<Result<T, E>> => {
  try { return ok(await fn()) }
  catch (e) { return err((mapErr ? mapErr(e) : (e as E))) }
}
```

No chain methods (no `.map`, `.andThen`). The router's `if (!result.ok)` shape is enough.

## Coding rules

### TypeScript

- `"strict": true` everywhere. No `any`. `unknown` at boundaries; narrow with Zod.
- **No explicit return types on functions.** Let inference do the work. Result types and Drizzle infer correctly through the layers.
- Prefer `type` over `interface` unless declaration merging is needed.
- Discriminated unions for errors (`{ kind: 'not_found' } | { kind: 'db_error' }`) over throwing.

### Style

- Functional first. Prefer arrow exports + composition over classes. Classes only for things that must be instances (e.g. SSE manager state).
- No mutable shared state. Pass values; return values.
- Pure functions where possible — DB calls and HTTP are the only legitimate side-effect points.
- Avoid clever metaprogramming. Boring code beats elegant code.

### Errors

- Domain code never throws. Everything propagates as `Result`.
- Try/catch only at:
  - Repositories (around the Drizzle call) → mapped to `Err`
  - Workers (around the provider call) → mapped to `Err` and updates `generation.status = 'failed'`
  - Library boundaries that might throw (parse, fetch) → wrapped at call site
- Router converts Err → HTTP. That's the sole conversion point.

### Naming

- Variables and functions: `camelCase`.
- Types and components: `PascalCase`.
- Files: `kebab-case` (e.g. `brand-profile.ts` for cross-entity helpers; entity folders use bare `router.ts` etc.).
- Test files: `<thing>.test.ts` co-located with the source.

## Workers

- All AI calls except synchronous text generation live in workers (`apps/worker`), not the API.
  - Image generation (image-mode and text-mode)
  - Brand-profile extraction from PDF
- Synchronous text generation (copy variants, translation) stays in the API process — the ≤2s budget makes a queue round-trip wasteful.
- Workers consume BullMQ jobs, write `generation` and `usage_event` rows, push completion events via Redis pub/sub.
- API exposes the SSE endpoint; on subscribe, it joins the same Redis pub/sub channel and forwards events to the client.
- BullMQ retry config per job lives in the job definition, not the worker handler.

### SSE in the Figma plugin

Confirmed in `research/figma-plugin.md`: the UI iframe has full browser `EventSource` and fetch streaming. The plugin manifest must whitelist the SSE URL.

### Worker layout

```
apps/worker/src/<job-name>/
  worker.ts         BullMQ worker registration + handler
  service.ts        the actual work (calls repositories from packages/db, AI SDK from packages/ai)
  types.ts          job payload type
```

## Validation

- All inbound HTTP payloads validated by Zod schemas via `@hono/zod-validator`.
- Schemas live in `packages/shared/schemas/` so the web app reuses them for forms (TanStack Form + Zod).
- `unknown` at the wire boundary, narrowed by Zod, `T` everywhere downstream.

## Logging

- pino at the API and worker entry points.
- JSON output always. Human-readable formatting via `pino-pretty` only in local dev.
- One logger per request, attached to the Hono context, with `requestId`, `userId`, `orgId` baked in.
- No `console.log` in committed code.

## Env management

- `t3-env` defines a typed schema per app:
  ```ts
  export const env = createEnv({
    server: {
      DATABASE_URL: z.string().url(),
      REDIS_URL: z.string().url(),
      WORKOS_API_KEY: z.string(),
      OPENAI_API_KEY: z.string(),
      AWS_S3_BUCKET: z.string(),
      // ...
    },
    runtimeEnv: process.env,
  })
  ```
- Importing `env` outside of an app's bootstrap is fine — values are validated once at startup.
- Local `.env.local` is gitignored. `.env.example` checked in with placeholder values.

## Tests

- Vitest only.
- Unit tests: pure functions in services / repositories with mocked DB.
- Integration tests: real Postgres via `docker-compose up` (single dev DB, truncate between tests).
- Co-located: `foo.ts` and `foo.test.ts` in the same folder.
- No coverage targets. Critical paths covered; the rest happens organically.

## Frontend conventions (admin web)

- Pages composed in TanStack Router file-based routes.
- TanStack Query for all server state. No global client state library — local state via `useState`, derived state via `useMemo`.
- Forms: TanStack Form + the shared Zod schemas from `packages/shared`.
- Components: shadcn/ui copy-paste primitives in `packages/ui`. App-specific compositions in `apps/web/src/components`.
- Charts: Recharts via shadcn's `<Chart>` wrapper. CSS vars for theming.
- Animations: framer-motion. Keep them subtle and purposeful.

## Out of scope (this engineering pass)

- Pre-commit / pre-push git hooks
- Sentry or any error tracking
- Feature flags
- CI configuration specifics (covered by general CD pipeline; not detailed here)
- Storybook / component sandboxing
- Visual regression testing
- Code coverage gates
