# Source Docs — Input for `/impeccable teach`

This landing page presents an architecture-case-assessment deliverable for a platform that lets designers work with AI-generated, brand-true creative directly inside Figma.

All authoritative content for the landing comes from the markdown docs in `../../docs/` and `../../docs/designs/`.

## Map of source docs

| Source | Use for landing section |
|---|---|
| `../../docs/assessment.md` | Section 1 — Problem statement |
| `../../docs/features.md` | Section 2.1 — Features (Figma plugin, admin web, platform capabilities) |
| `../../docs/architecture.md` | Section 2.3 — System diagram + how it balances UX / dev effort / short-term / long-term |
| `../../docs/data-flow.md` | Section 2.3 supporting — narrative for "localise copy + replace images" |
| `../../docs/tooling.md` | "Tech choices + trade-offs" — single OpenAI provider stack |
| `../../docs/engineering.md` | Optional callout — codebase conventions |
| `../../docs/data-model.md` | Optional callout — multi-tenant schema |
| `../../docs/roadmap.md` | Section 3 (dev effort + MVP scope), Section 4 (short-term), Section 5 (long-term), risks + mitigations |
| `../../docs/research/figma-plugin.md` | Background only — plugin runtime constraints that shaped the API |
| `../../docs/designs/*.md` | Per-feature reference — only deepen if a section needs it |

## Landing page sections (the user-requested outline)

1. **Problem statement** — DesignTechCo's 3-day localisation lag, brand governance drift across 25 brands × 8 locales, designers leaving Figma to hunt stock photos.
2. **Solution**
   2.1 **Features** — copy variants, translation (8 locales), image placeholders (text-to-image + image-to-image), brand-guideline lifecycle, generations history, usage dashboard. Mix English explanation with light tech detail.
   2.2 **UI** — actual Astro/React mockup screens for Brands list, Brand-guideline editor, Generations history, Usage dashboard. Real components, not stylised illustrations (path B per project decision).
   2.3 **System diagram** — the component diagram from `architecture.md` (mermaid), accompanied by the data-flow narrative.
3. **Development effort** — MVP scope (10 weeks, 2 engineers), what ships, what's deferred. From `roadmap.md` Phase 1.
4. **Short-term impact** — pilot for the 10-person Creative Studio: 3-day localisation → under 5 min, per-user cost attribution, 99% availability. From `roadmap.md` MVP exit criteria.
5. **Long-term impact** — multi-tenant SaaS for 100+ concurrent users across many orgs. Tenant boundary baked in from day 1. From `architecture.md` multi-tenant readiness + `roadmap.md` Phase 3.

Plus weave in:

- **Tech choices + trade-offs** — single OpenAI provider rationale, no fallback in MVP, soft-delete patterns, structured extraction over RAG, etc.
- **Phased roadmap** — MVP → Beta → Full roll-out timeline + per-phase risks/mitigations.

## Audience

Reviewer of an architecture case assessment (Superside hiring panel). Senior product engineers and architects. Looking for clarity of thought, consistency of decisions, justified trade-offs, practical short-term-vs-long-term thinking, and design polish that proves the candidate can ship product, not just specs.

## Anti-references

Avoid:

- Generic SaaS landing copy ("Boost your team's productivity!"). Be specific.
- AI clichés (purple gradients, neural-network mascots, "powered by AI" badges).
- Hero-metric template (big number, small label) — banned in `SKILL.md`.
- Identical card grids — banned.
- Em dashes in copy — banned.

## Aesthetic anchor

The chosen visual direction was selected from 4 gpt-image-2 probes (`scratch/aesthetic-probes/`):

**Probe 01 — Editorial** (cream `#faf9f5` background, serif headlines, restrained palette with one warm accent, Stripe / Linear register).

The reference image is `aesthetic-anchor.png` in this same directory. Use it as the dominant visual reference when establishing palette, type, spacing, and overall mood. Don't copy the example UI shown — produce our own.

## Hard requirements for the build

- Astro + Tailwind 4 (already wired up in `astro.config.mjs`).
- No Tremor; charts via Recharts inside any React island if needed.
- Single-page scroll with anchored sections.
- Real React mockup screens (path B) for section 2.2 — not stylised wireframes.
- No genrative AI aesthetic clichés. See `SKILL.md` "AI slop test" and "Absolute bans".
