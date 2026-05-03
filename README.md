# Studio · Architecture-case deliverable for Superside

End-to-end deliverable for the Superside AI Consulting Lead Product Engineer architecture case. The brief asked for a platform that lets designers work with AI-generated, brand-true creative directly inside Figma. This repo answers it three ways:

1. **Source-of-truth markdown** in [`docs/`](docs/) — written narratives, schemas, decisions, roadmap, per-feature designs.
2. **Excalidraw companion deck** in [`diagrams/`](diagrams/) — 15 frames that visualise topology, data flows, lifecycles, and tech decisions.
3. **Single-page landing site** in [`landing/`](landing/) — public summary at **<https://josorio7122.github.io/superside-assessment/>**.

The three layers fit together: landing is the elevator pitch, the Excalidraw deck is the deeper visual argument, the markdown is the load-bearing detail.

---

## Process — how this came together

The work followed five passes, each producing artifacts the next pass built on.

### 1. Read the brief

[`docs/assessment.md`](docs/assessment.md) is the source brief from Superside. It defines four functional requirements (copy variants, translation, brand-guideline ingestion, image placeholders) and five non-functional ones (≤2s sync latency, SSO, 5× scale headroom, cost attribution, 99% availability). Every downstream decision traces back to a line in this file.

### 2. Research

Before locking in a stack, the constraints external systems would impose had to be understood. [`docs/research/figma-plugin.md`](docs/research/figma-plugin.md) captures the Figma plugin platform's two-thread runtime, the post-November-2025 OAuth review changes, the manifest network-allowlist mechanics, the `figma.createImageAsync` / `loadFontAsync` / mixed-font caveats, and the `clientStorage` "stability not security" disclaimer. The plugin is the load-bearing client and most architectural decisions trace back to constraints in this doc.

### 3. Feature definition + scoping

[`docs/features.md`](docs/features.md) enumerates every user-facing capability, grouped by surface (Figma plugin, admin web, platform). Each row maps to one of the brief's requirements. The "What ships in 8 weeks" section is where scope discipline starts: nothing is "future" — every feature lands inside the 8-week target / 10-week ceiling, with deferrals (image-to-image, ClickHouse migration, RAG, per-tenant rate limits) called out explicitly.

### 4. Architecture

[`docs/architecture.md`](docs/architecture.md) lays out the top-level shape: three columns (clients, auth+server+db, async+models+storage), eight components, multi-tenant from day one, ~~OpenAI-only~~ OpenRouter-for-text and OpenAI-direct-for-image at MVP, BullMQ + Redis pub/sub + SSE for the async path. [`docs/data-model.md`](docs/data-model.md) is the Postgres schema. [`docs/data-flow.md`](docs/data-flow.md) walks one user action end-to-end through every component. [`docs/tooling.md`](docs/tooling.md) records the picks + the rejects with reasons. [`docs/engineering.md`](docs/engineering.md) covers conventions, the monorepo layout, the `Result<T, E>` error model.

### 5. Roadmap

[`docs/roadmap.md`](docs/roadmap.md) phases the work: MVP (weeks 0–3, 10 users, internal pilot at DesignTechCo), Beta (3–6, 1–2 additional client orgs, RBAC + multi-provider routing + fal.ai integration + plugin live publicly), Final Rollout (6–8, security review, performance pass, analytics scaling decision gated on Beta metrics, on-call rotation). Risks are tabulated per phase plus a cross-cutting set.

### Per-feature designs

[`docs/designs/`](docs/designs/) holds seven backend design passes — one per feature surface (auth, brand management, brand-guideline lifecycle, generations history, image generation, text-layer generation, usage dashboard). Each design includes API contracts, Mermaid sequence diagrams, error model, persistence schema, and locked decisions.

### Adversarial review

After the writing was done, five sub-agents did fresh web research to audit every load-bearing claim — vendor names, API signatures, framework features, numbers, internal contradictions. They surfaced ~50 issues. The fixes are in this commit history. The review process itself is captured in the spirit of the docs — claims are falsifiable, citations exist where they matter.

---

## Layout

```
superside-assessment/
├── README.md                    ← you are here
├── docs/                        Source-of-truth markdown
│   ├── README.md                Reading order + how docs relate
│   ├── assessment.md            (the brief)
│   ├── features.md              (what we'll build)
│   ├── research/figma-plugin.md (constraints from external systems)
│   ├── architecture.md          (top-level shape)
│   ├── data-model.md
│   ├── data-flow.md
│   ├── tooling.md
│   ├── engineering.md
│   ├── roadmap.md               (phased plan + risks)
│   └── designs/                 (per-feature backend designs)
├── diagrams/                    Excalidraw companion deck
│   ├── README.md                Frame-by-frame index + how to view
│   └── architecture.excalidraw  15 frames, ~330 elements
├── landing/                     Astro single-page site
│   ├── README.md                Stack + dev + deploy
│   ├── PRODUCT.md / DESIGN.md / AGENTS.md   Design context (impeccable skill)
│   ├── design-process/          Aesthetic anchor + shape brief + source-doc map
│   └── src/                     Components, layouts, pages, styles
└── .github/workflows/deploy.yml GitHub Pages deploy on push
```

## How to navigate

- **First-time reviewer:** open the [live landing site](https://josorio7122.github.io/superside-assessment/) for the elevator pitch.
- **Going deeper:** open [`diagrams/architecture.excalidraw`](diagrams/architecture.excalidraw) in [excalidraw.com](https://excalidraw.com) (drag-drop the file). Frame index in [`diagrams/README.md`](diagrams/README.md).
- **All the detail:** start at [`docs/README.md`](docs/README.md) and follow the reading order.
- **Design process behind the landing:** [`landing/design-process/`](landing/design-process/).

## Key decisions

A few that shape the rest. Each is justified in the source doc cited.

| Decision | Where | Why |
|----------|-------|-----|
| OpenRouter for text from MVP, OpenAI direct for image | `docs/tooling.md`, `docs/architecture.md` §5 | Single text gateway from day one — multi-provider becomes config flip in Beta. Image gen stays direct because OpenRouter image support is thin. |
| Image-to-image lands in Beta via fal.ai | `docs/roadmap.md` Phase 2, `docs/designs/image-generation.md` | OpenAI's `images.edit` does not currently accept `gpt-image-2`; fal.ai's `gpt-image-2/edit` does. |
| Postgres source of truth; analytics scaling decided at Final Rollout | `docs/architecture.md` §6, `docs/roadmap.md` Phase 3 | Three-branch decision tree (skip rollups / build daily aggregates / migrate to ClickHouse) gated on actual Beta volume — avoids pre-committing to infra we may not need. |
| WorkOS for auth + RBAC + tenant onboarding | `docs/architecture.md` §7, `docs/designs/auth-sso.md` | Hybrid pattern — WorkOS Roles for the coarse axis (admin / brand_manager / designer), `user_brand` mapping in our Postgres for the fine axis (per-resource scope). |
| PostHog as the only observability vendor | `docs/architecture.md` §8 | One vendor across errors, alerts, replay, flags, analytics, LLM tracing, and per-feature LLM evals. Fits a 2-engineer team. Lands in Beta. |
| Structured extraction over RAG | `docs/designs/brand-guideline-management.md` | Single canonical brand profile per brand, fixed JSON schema, deterministic prompt construction. No vector store, no retrieval drift, mandatory human review before publish. |

## Contact

Repo: <https://github.com/josorio7122/superside-assessment>
Live landing: <https://josorio7122.github.io/superside-assessment/>
