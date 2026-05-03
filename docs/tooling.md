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
| Text + translation gateway | OpenRouter | Single endpoint, single key, per-call provider routing. MVP hardcodes the model to GPT-5.1 (or GPT-5.4 if 5.1 retired by ship date — both available on OpenRouter, 5.4 is cheaper). Beta uses OpenRouter routing primitives to send specific features to different models without changing call sites. Adds ~5% gateway markup; bought outright by skipping multi-provider integration work later. |
| Text + translation model (MVP) | GPT-5.1 (via OpenRouter) | Successor to GPT-4o, the "GPT-4o or equivalent" tier the assessment calls for. Strong cached-input pricing ($0.125/M) for the reusable brand voice block. Pinned by env config; swapped to GPT-5.4 with one config change if 5.1 deprecated upstream. |
| Image generation (MVP) | gpt-image-2 direct (OpenAI) | Released April 21, 2026. Multi-image-per-request, multilingual text rendering. **Text-to-image only at MVP** — `images.edit` does not currently accept `gpt-image-2` (OpenAI restricts edit to gpt-image-1 / 1.5 / dall-e-2 today). Image-to-image lands in Beta via fal.ai (which exposes `gpt-image-2/edit` plus its own Flux family). |
| Image generation (Beta) | fal.ai (image-to-image + fallback) | Beta lights up fal.ai for two reasons: (a) image-to-image support for `gpt-image-2` via fal's edit endpoint, (b) cross-provider fallback if OpenAI image throttles. Same `packages/ai` call site; provider chosen per request. |
| PDF extraction model | GPT-5.1 multimodal (via OpenRouter) | Renders PDF pages as images and extracts the structured `BrandProfile` in one pass. Same gateway as text. |

## Explicitly out of scope

These have been parked by design and are not covered in this submission.

- **Hosting / deployment specifics** — service placement, environments, autoscaling
- **Infrastructure as Code** — Terraform / Pulumi / CDK
- **Observability tooling at MVP** — lands in Beta via PostHog (errors, alerts, replay, feature flags, product analytics, LLM tracing, evals)
- **Figma plugin implementation details** — plugin SDK, manifest, distribution (covered in `research/figma-plugin.md`)
- **RAG / vector search** — replaced by structured `BrandProfile` extraction; pgvector dropped from stack

## Notes on what we did NOT pick

- **DeepL** for translation — strong on European languages but weak on tone; LLMs preserve brand voice better
- **GPT-4o** as the text model — superseded by GPT-5.x across the board: cheaper input, same output price, cheaper cached input. No reason to stay on it.
- **Direct OpenAI key for text** — consolidated through OpenRouter instead. ~5% markup buys per-call provider routing, eval-driven model picks per feature in Beta, and simpler model swaps as upstream models are deprecated.
- **fal.ai Flux Pro 1.1** as the MVP image model — `gpt-image-2` beats Flux on text-in-image rendering and multilingual support, both useful for ad placeholders. fal.ai still ships in Beta as the image-to-image path and image fallback.
- **`gpt-image-1`** — superseded by `gpt-image-2` across nearly every capability axis (caveat: gpt-image-1 / 1.5 still serve `images.edit`; we use fal.ai's `gpt-image-2/edit` for that path in Beta instead).
- **pg-boss** for the queue — workable but BullMQ has richer retry semantics and the Redis dependency was acceptable.
- **pgvector / dedicated vector DB** — initially considered for RAG over brand guidelines; dropped after we decided structured extraction is a better fit (single canonical doc per brand, fixed schema, deterministic prompt construction).
- **Embedding model** — would only be needed if we did RAG; not in MVP.
