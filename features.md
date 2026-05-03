# Features

User-facing capabilities grouped by surface. Eight-week target inside a ten-week ceiling. Two senior engineers paired with AI coding agents. Every feature ships in scope: RBAC via WorkOS, full observability + per-feature evals via PostHog, public plugin distribution.

## A. Figma Plugin (Designer surface)

| # | Feature | Maps |
|---|---------|------|
| A1 | Sign in via SSO; pick brand context | Auth |
| A2 | Select text layer(s) → "Generate copy variants" → see N options → pick one → applies to layer | Copy |
| A3 | Select text layer(s) → "Translate to locale" → pick from 8 → apply | Translation |
| A4 | Select frame/fill layer → "Generate image" (text or image input) → see options → apply as image fill | Image |
| A5 | Batch: run A2/A3 across multiple layers in one click | Productivity |
| A6 | Brand context indicator (which brand active, swap) | Grounding |
| A7 | History panel: recent generations on this file, re-apply, undo | UX |
| A8 | Async progress for image gen (job submitted → notify when ready) | Async path |

## B. Admin Web App (Creative Ops + brand managers)

| # | Feature | Maps |
|---|---------|------|
| B1 | Sign in via SSO | Auth |
| B2 | Manage brands (create, edit, archive) | Brand mgmt |
| B3 | Brand-guideline lifecycle: upload PDF (or hand-author), structured extraction, manual edits, versioning, rollback | Grounding |
| B4 | Manage locales available per brand (subset of 8) | Translation |
| B5 | RBAC surface: assign roles (`admin` / `brand_manager` / `designer`) and per-user brand access | Access control |
| B6 | WorkOS Admin Portal embed for org user management | User mgmt |
| B7 | Generations history: list + detail + live SSE updates + per-row latency, cost, applied variant | Governance |
| B8 | Generations history: filters (user, brand, type, status, date) + search | QoL (Final Rollout) |
| B9 | Usage dashboard: calls, tokens, $, latency — by user / brand / feature / locale / model | Cost attribution |
| B10 | Per-user / per-brand spend caps + soft alerts | Cost guardrail |
| B11 | Eval results surface: nightly per-feature eval pass/fail, regression history | Quality |
| B12 | Tenant onboarding via WorkOS Admin Portal | Multi-tenant |

## C. Platform Capabilities (cross-cutting)

| # | Feature | Maps |
|---|---------|------|
| C1 | SSO/OAuth + session management (WorkOS sealed sessions) | Auth |
| C2 | RBAC enforcement: every router scope-checks `(org_id, user_id, role, brand_id)` | Governance |
| C3 | LLM proxy: provider routing, retries with circuit breaker, prompt cache | Reliability |
| C4 | Per-call metering event (user, tenant, brand, feature, tokens, cost, latency) | Cost attribution |
| C5 | Async job + worker (image gen, extraction, batch) with SSE notifications | Async path |
| C6 | Structured PDF extraction pipeline (multimodal LLM → `BrandProfile` JSON) | Grounding |
| C7 | Audit log of all generations (input, output, user, brand, locale) — implicit via the `generation` table | Governance |
| C8 | PostHog observability: errors, alerts, session replay, feature flags, product analytics, LLM tracing, per-feature LLM evals | Reliability + quality |
| C9 | Daily rollup tables (`usage_daily`) for analytics dashboards at scale; drill-down to raw `usage_event` | Analytics scale |
| C10 | CI/CD pipeline | Delivery |

## What ships in 8 weeks (10-week ceiling for buffer)

Everything above. The full architecture lands inside the budget. No Phase 4 backlog of must-haves.

- **Weeks 0–3 (MVP, 10 users)**: A1–A4, A6, A8 plugin core; B1–B3, B6, B7, B9 admin core; C1, C3, C4, C5, C6, C7, C10 platform foundations. Plugin submitted to Figma Community at end of week 3.
- **Weeks 3–6 (Beta, more users)**: A5, A7 plugin polish; B4, B5, B10, B11, B12 admin completion; C2, C8 platform additions. Public plugin listing goes live mid-Beta.
- **Weeks 6–8 (Final Rollout, many users)**: B8 quality-of-life filters + search; C9 daily rollup tables. Security review, performance pass, eval threshold tightening, on-call rotation.

## What's deliberately not in scope

- **A columnar warehouse (ClickHouse or equivalent)** for `usage_event`. Postgres + daily rollup tables answer every dashboard query through the scale this product reaches in 12–24 months. PostHog already gives us managed columnar storage for telemetry. A warehouse migration is a future option, triggered by ~500k events/day sustained or customer-facing analytics surfaces.
- **Per-tenant rate limits and concurrency caps.** Same-provider retries plus single-OpenAI-key concurrency are sufficient until customer usage demands tighter caps. Adding caps is a config change in the LLM proxy.
- **Cross-provider fallback** (OpenAI → Claude or fal.ai). The AI-SDK abstraction makes adding fallback a config change rather than a rewrite. Post-launch opt-in.
- **RAG over brand guidelines.** Replaced by structured extraction (C6). Single canonical profile per brand, fixed schema, deterministic prompt construction.
