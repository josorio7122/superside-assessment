# Tooling & Stack

Locked technical choices for the platform. Anything not listed here is intentionally out of scope until later.

## Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Frontend (admin web + plugin UI) | React + TypeScript | Standard, fits Figma plugin SDK constraints, single language with backend |
| API framework | Hono | Lean, TS-first, fast, edge-friendly |
| Backend runtime | Node + TypeScript | Same language as frontend; minimizes context switching for a two-engineer team |
| Auth / Identity | WorkOS | Native SSO + Organizations primitive lets us model multi-tenant from day 1 without writing identity infrastructure |
| Primary database | Postgres | Relational fit for tenants/users/generation lifecycle; mature operationally |
| ORM | Drizzle | TypeScript-native, SQL-close, lighter than Prisma |
| Job queue | BullMQ over Redis (or Valkey) | Mature TS queue with built-in retry/backoff, delayed jobs, repeatable jobs |
| Object store | S3 (or compatible) | PDF source storage and generated image storage |
| LLM (text + translation) | GPT-5.1 (OpenAI) | Successor to GPT-4o, qualifies as the "GPT-4o or equivalent" tier the assessment calls for. Cheaper than GPT-4o on input ($1.25 vs $2.50/M), same on output ($10/M), 10× cheaper on cached input ($0.125/M) — meaningful for prompt caching of the brand voice block. Same OpenAI key as image gen. No provider fallback in MVP. |
| LLM (image generation) | gpt-image-2 (OpenAI) | Released April 21, 2026. Typical <3s latency, ≥99% text-rendering accuracy, native multi-image-per-request, supports image-as-input via `images.edit`. Same OpenAI key as text. No provider fallback in MVP. |
| LLM (PDF extraction) | GPT-5.1 multimodal (OpenAI) | Renders PDF pages as images and extracts the structured `BrandProfile` in one pass |

## Explicitly out of scope

These have been parked by design and are not covered in this submission.

- **Hosting / deployment specifics** — service placement, environments, autoscaling
- **Infrastructure as Code** — Terraform / Pulumi / CDK
- **Observability tooling** — APM, log aggregation, dashboards
- **Feature flags** — gradual-rollout tooling
- **Figma plugin implementation details** — plugin SDK, manifest, distribution
- **RAG / vector search** — replaced by structured `BrandProfile` extraction; pgvector dropped from stack

## Notes on what we did NOT pick

- **DeepL** for translation — strong on European languages but weak on tone; LLMs preserve brand voice better
- **GPT-4o** as the text model — superseded by GPT-5.1 across the board: cheaper input, same output price, 10× cheaper cached input. No reason to stay on it.
- **Claude Sonnet 4.6** for text generation — measurably stronger on long-form brand voice retention per benchmarks. We accept the tradeoff to consolidate on a single OpenAI provider; the Vercel AI SDK abstraction makes flipping to Claude later a configuration change, not a rewrite.
- **fal.ai Flux Pro 1.1** for image generation — was faster than `gpt-image-1`, but `gpt-image-2` (April 21, 2026) closes the latency gap (<3s typical) and beats Flux on text-in-image rendering and multilingual support — both useful for ad placeholders.
- **`gpt-image-1`** — superseded by `gpt-image-2` across nearly every capability axis.
- **Provider fallback** (e.g. OpenAI → Claude or fal.ai as backup) — explicitly out for MVP. Same-provider retries on transient errors stay; cross-provider switching is a Phase 3 opt-in. Keeps the system observable and the per-call cost predictable.
- **Two-provider stack (Anthropic + fal.ai)** — earlier candidate; consolidated on OpenAI for streamlined ops (one API key, one billing surface, one rate-limit pool).
- **pg-boss** for the queue — workable but BullMQ has richer retry semantics and the Redis dependency was acceptable
- **pgvector / dedicated vector DB** — initially considered for RAG over brand guidelines; dropped after we decided structured extraction is a better fit (single canonical doc per brand, fixed schema, deterministic prompt construction)
- **Embedding model** — would only be needed if we did RAG; not in MVP
