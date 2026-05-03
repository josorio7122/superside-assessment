# Architecture documentation

Source-of-truth markdown for the Studio architecture-case deliverable. Read in order — each doc builds on the previous one.

## Reading order

| # | Doc | What it answers |
|---|-----|-----------------|
| 01 | [`assessment.md`](assessment.md) | Source brief from Superside (functional + non-functional requirements, constraints, audience) |
| 02 | [`features.md`](features.md) | User-facing capabilities by surface — Figma plugin (A1–A8), admin web (B1–B12), platform (C1–C10) |
| 03 | [`research/figma-plugin.md`](research/figma-plugin.md) | Plugin runtime constraints that shaped the API (two-thread sandbox, fetch wrapper, OAuth, distribution) |
| 04 | [`architecture.md`](architecture.md) | Top-level architecture, component diagram, data stores, multi-tenant readiness, eight components in detail |
| 05 | [`data-model.md`](data-model.md) | Postgres schema — tables, indexes, partial-uniques, jsonb shapes |
| 06 | [`data-flow.md`](data-flow.md) | E2E walkthrough — "localise copy + replace images" trace through every component |
| 07 | [`tooling.md`](tooling.md) | Locked stack, picked vendors, what we did NOT pick and why |
| 08 | [`engineering.md`](engineering.md) | Coding conventions, monorepo layout, Result pattern, error model |
| 09 | [`roadmap.md`](roadmap.md) | Phased plan — MVP (weeks 0–3), Beta (3–6), Final Rollout (6–8). Risks per phase + cross-cutting risks |
| 10 | [`designs/`](designs/) | Per-feature backend designs — auth, brand mgmt, brand-guideline lifecycle, generations history, image gen, text-layer gen, usage dashboard |

## How the docs relate

```
assessment.md    (the brief)
      ↓
features.md      (what we'll build to satisfy the brief)
      ↓
research/        (constraints external systems impose on us)
      ↓
architecture.md  (top-level shape)
      ↓
data-model.md    + data-flow.md + tooling.md + engineering.md  (implementation surface)
      ↓
roadmap.md       (when each piece lands)
      ↓
designs/         (per-feature backend specs)
```

## Audience

Senior engineering / architecture reviewers from the Superside hiring panel. Looking for clarity of thought, justified trade-offs, practical short-term-vs-long-term thinking. Every claim should be falsifiable and trace back to evidence.

## See also

- **`../landing/`** — single-page Astro site that walks a reviewer through this material visually. Live at <https://josorio7122.github.io/superside-assessment/>.
- **`../diagrams/architecture.excalidraw`** — companion Excalidraw deck (15 frames) that goes deeper than the landing on topology, data flows, lifecycle state machines, and tech decisions.
