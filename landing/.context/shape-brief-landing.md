# Shape brief — Studio landing page

Produced via `/impeccable shape landing`. User-confirmed. Hand off to `/impeccable craft landing` (or sub-section craft calls) for build.

> **Status:** confirmed. Do not modify without re-running `/impeccable shape landing`.

## 1. Feature Summary

Single-page, scroll-anchored landing presenting `Studio`, the AI-creative-in-Figma platform, as the deliverable for an architecture-case assessment. The page itself is the argument: polish proves shipping skill, structure proves architectural thinking, every claim traces to a source doc in the repo root. Audience: Superside hiring panel reading on a desktop in business hours.

## 2. Primary User Action

**Read top to bottom and finish convinced of two things equally: this person ships, and this person thought about the trade-offs.** No conversion. No CTA-driven flow. The page is a long read with anchored sections and one ornamental "Open repo" / "Read source docs" link in the nav. Anchor nav is the only navigation primitive.

## 3. Design Direction

- **Color strategy**: Restrained. Inherits PRODUCT.md / DESIGN.md. Warm Ash Cream canvas, Editorial Charcoal + Reading Charcoal text, one Editorial Coral accent ≤10% of any viewport, reserved for primary CTA, anchor-active state, two or three editorial-emphasis runs.
- **Theme scene sentence**: "Senior engineer reads this on a 27-inch monitor at 11am with a coffee, allergic to generic SaaS, deciding in 90 seconds whether to keep reading." Forces light cream. Forces high typographic confidence.
- **Anchor references**: Stripe.com (system page polish), Linear.app (typographic restraint), Anthropic.com (warm cream + serif headlines + long-form essay register). Locked by PRODUCT.md.
- **Lane held**: editorial-typographic. Identity-preservation rule applied (anchor was user-confirmed via gpt-image-2 probes). Differentiate via execution craft, not lane choice.

## 4. Scope

- **Fidelity**: production-ready.
- **Breadth**: full landing — global header + hero + 5 sections (problem, solution, dev effort, short-term, long-term) + footer.
- **Interactivity**: shipped-quality. Real React mockups inside Astro islands. Tab-switcher interactivity on Section 2.2. Scroll-reveal opacity transitions. Anchor-link smooth-scroll.
- **Time intent**: polish until it ships.

## 5. Layout Strategy

**Vertical rhythm via deliberate spacing variance, not uniform stacks.** Sections breathe at different heights — problem statement tight and dense, solution sprawling, roadmap symmetric.

- **Editorial gutter system**: a wide outer gutter (16–24% on desktop), an inner reading column capped at 65–72ch, an optional wider visual gutter that the mockup frames and system diagram break into. Body prose stays in the reading column. Visual artifacts (mockup frame, system diagram, three-column roadmap) escape into the wider gutter.
- **Asymmetric where it earns it, centered where it doesn't.** Hero is split (left text, right mockup). Sections 1, 3, 4, 5 are left-aligned in the reading column. Section 2 (solution) breaks rhythm: features as left-aligned editorial list, mockups as wide-gutter break-out, system diagram as full-bleed editorial illustration.
- **Section eyebrows**: small uppercase mono labels above each section heading (e.g. `01 — Problem`, `02 — Solution`). Mono carries the architecture-document voice without colonizing body type. Anchor IDs match: `#problem`, `#solution`, `#effort`, `#short-term`, `#long-term`.
- **Hero**: split, ~55/45. Left: oversize Display serif headline, two-line meta in Reading-Charcoal sans, Editorial-Coral primary CTA ("Read the case"), secondary text-link ("View source docs"). Right: the strongest mockup screen (Brand-guideline editor) sitting on the Mockup-Ambient shadow inside its own chrome frame. No screenshot — real React island, frozen state.
- **Section 2.2 mockup region**: tabbed switcher inside one mockup-frame chrome. Tabs sit above the frame as small uppercase mono labels (`brands` `guideline` `history` `usage`), active tab gets the coral underline, inactive tabs get Quiet Stone. Frame swaps content via opacity-only crossfade; height stays constant (auto-height would jank).
- **Section 2.3 system diagram**: hand-set SVG, full-bleed within wide gutter, editorial labels in serif (component names) + mono (endpoints), thin Hairline strokes for arrows. Sits inside a `<figure>` with a paragraph-length `<figcaption>` summarizing the data flow narrative for a11y.
- **Roadmap section (Phase 5)**: three-column editorial. Above the columns, a thin horizontal rule with three coral dots marking phase boundaries, labeled `MVP — week 0` / `Beta — week 10` / `Full — week 24+`. Each column: phase name (Title), prose paragraph (Body), risk/mitigation pair (Reading + mono prefix). Columns roughly equal but not pixel-identical — slight content-driven height variance is correct, not a bug.
- **Header**: thin sticky nav, left-aligned `Studio` wordmark in Display serif, right-aligned section-anchor links + secondary "Read source docs" link. Coral accent on active section. Backdrop is the cream canvas at 92% opacity with a 12px backdrop blur — the one allowed glass moment, justified by needing legibility against scrolling content. (DESIGN.md flat-by-default rule respected: nav doesn't claim elevation, just legibility.)
- **Footer**: minimal. Two lines: "Architecture-case deliverable. Jose Osorio, May 2026." + "Source docs: GitHub link." No nav repeat.

## 6. Key States

- **Default (logged-in viewer scrolling)**: hero on first paint, anchor nav stuck at top after first 64px scroll.
- **First paint**: hero fully painted within 1s. Mockup frame can lazy-mount its React island after first paint without layout shift (reserve height with `aspect-ratio`). Body fonts display via `font-display: swap` against system serif/sans fallbacks tuned for similar metrics.
- **Section 2.2 mockup tabs**:
  - **Default tab**: `guideline` (Brand-guideline editor — most narratively important).
  - **Tab hover**: Quiet Stone label shifts to Reading Charcoal, ~150ms.
  - **Tab active**: Coral underline (1.5px, animates from 0 to full width on tab-click using `transform: scaleX`), Editorial Charcoal label.
  - **Tab transition**: outgoing content opacity 1→0 over 180ms, incoming 0→1 over 220ms, no transform.
- **Anchor nav active state**: as scroll passes each section, the matching nav link gains a coral underline. IntersectionObserver, not scroll-listener.
- **Reduced motion**: every transform/opacity transition collapses to instant swap. Anchor smooth-scroll reverts to native jump.
- **No-JS / island fallback**: if React island fails to hydrate, mockup region falls back to a static SSR'd image of the default `guideline` tab. Tabs stay visible but inert.
- **Mobile narrow (≤640px)**: hero stacks (text above, mockup below). Mockup frame goes edge-to-edge with reduced inner padding. Tabs become a horizontal scroll-snap row. Roadmap three-column collapses to vertical stack with the time-rule rotating to vertical (or omitted on narrowest widths). Anchor nav collapses to a section-progress indicator at the top edge.
- **No empty / loading / error states proper**: this is a static editorial landing. The mockup React islands render frozen demo state — no real data, no fetch, no errors.

## 7. Interaction Model

- **Entry**: page loads at the hero. No modal, no consent banner, no AI floating button.
- **Scroll-driven reveal**: each section reveals on scroll using IntersectionObserver. Treatment: section-eyebrow + heading translate up 8px and fade from 0 to 1 over 450ms with ease-out-quart. Body prose fades in without translate, 300ms. Mockup frame and system diagram never animate translate (they're heavy artifacts and translate-on-mount feels gimmicky on architecture content). Reduced motion: skip translate, keep fade.
- **Anchor nav click**: native smooth scroll. Active link updates as user lands on section.
- **Section 2.2 tab click**: tab gains active state, content crossfades, URL hash updates to `#solution-guideline` etc. for shareable deep-link to a specific mockup.
- **Mockup hover**: on the active mockup, hovering adds a subtle Mockup-Ambient shadow intensification (reduce shadow-bottom y-offset from 12px to 8px) over 200ms. Hover is signal of liveness, not an action.
- **Source-doc citations**: every non-trivial claim has a small mono superscript link (e.g. `[architecture.md]`) opening a side popover with the relevant excerpt. Popover is inline progressive-disclosure, not a modal.
- **Footer "Source docs" link**: opens the GitHub repo in a new tab. Not a CTA.

## 8. Content Requirements

All copy traces to repo-root markdown (`assessment.md`, `features.md`, `architecture.md`, `data-flow.md`, `roadmap.md`, `tooling.md`, `data-model.md`, `engineering.md`).

- **Hero headline (Display serif)**: needs to commit. Options for craft to choose between: (a) the literal problem ("Three days to localise, eight locales, twenty-five brands, ten designers."), (b) a quiet thesis ("A platform for designers, not a tool for designers."), (c) the deliverable framing ("An architecture brief, in working code.").
- **Hero meta (Reading Charcoal sans)**: 1–2 lines positioning the page. No marketing voice. Example: "An architecture-case deliverable for Superside. Internal codename: Studio."
- **Hero CTA**: "Read the case" (Editorial Coral primary). Secondary text-link: "View source docs ↗".
- **Section eyebrows**: `01 — Problem`, `02 — Solution`, `03 — Development effort`, `04 — Short-term impact`, `05 — Long-term impact` (uppercase mono, Quiet Stone).
- **Section 1 (Problem)**: three sentences, ruthless. DesignTechCo's three-day localisation lag, twenty-five brands × eight locales governance drift, designers leaving Figma to hunt stock. Source: `assessment.md`.
- **Section 2.1 (Features)**: editorial list, not card grid. Each feature: Title (sans semibold) + 2-line description. Six items max. Source: `features.md` MVP cut.
- **Section 2.2 (UI mockups)**: Tab labels + per-mockup caption (1-2 sentences). Captions name the screen and what it proves. Source: `designs/*.md`.
- **Section 2.3 (System diagram + data flow)**: figure caption summarizing the localise-copy-and-replace-images flow as 4-5 sentence narrative. Source: `architecture.md`, `data-flow.md`. Tooling rationale (single OpenAI provider, no fallback in MVP, soft-delete patterns, structured extraction over RAG) as a small sidebar paragraph or footnote.
- **Section 3 (Development effort)**: prose, not a Gantt. 10 weeks, 2 engineers, what ships, what's deferred. Source: `roadmap.md` Phase 1.
- **Section 4 (Short-term impact)**: pilot for the 10-person Creative Studio. The "3-day localisation → under 5 minutes" line set as editorial emphasis (italic + coral run), not a stat tile. Per-user cost attribution and 99% availability as supporting prose.
- **Section 5 (Long-term impact)**: multi-tenant SaaS for 100+ concurrent users. Tenant boundary baked in from day 1. Followed by the three-column roadmap (MVP / Beta / Full).
- **Footer**: as Layout Strategy.
- **Copy bans**: no em dashes. No "Boost productivity" / "Built for modern teams" / "Powered by GPT-4o". No restated section headings inside section bodies. No marketing adjectives.
- **Microcopy**: skip-to-content link copy `Skip to content`. Tab role labels for screen readers (`Brands list`, `Brand-guideline editor`, etc.). System-diagram alt: 4-5 sentence narrative `<figcaption>`.

## 9. Recommended References

Implementation phase should consult:

- `reference/brand.md` — the lane is editorial-typographic, but identity-preserved. Re-read the reflex-reject aesthetic lanes section before final type and headline composition.
- `DESIGN.md` (this project) — every token, rule, and Don't.
- `.context/aesthetic-anchor.md` — concrete signals from the chosen visual probe.
- `.context/source-docs.md` — section-to-source-doc map.
- `architecture.md`, `roadmap.md`, `assessment.md`, `features.md`, `data-flow.md`, `tooling.md` — content source-of-truth.
- For Astro + React island wiring inside Astro 6: pull `@astrojs/react` integration and load mockup components via `client:visible` to defer hydration.
- For SVG system diagram: hand-author. Reference the mermaid in `architecture.md` only as topology, not as visual style.

## 10. Open Questions

Answer during craft, not now:

1. **Hero headline choice**: which of the three options in §8 wins. Decide by writing all three at the final type scale and reading them cold.
2. **Mockup "frozen state" content**: the Brand-guideline editor mockup shows what specifically? A pre-extraction PDF view, mid-extraction, or post-edit BrandProfile JSON? Pick the moment that reads most like a real product.
3. **System diagram label discipline**: which component names carry mono (endpoints, services) vs serif (categories). Mono everywhere reads as terminal-cosplay; serif everywhere reads as marketing.
4. **Source-doc citation popover**: build the inline progressive-disclosure now, or defer to v2 and ship plain text mono filenames as visual citations only? Decide by build-cost-vs-impact during craft.
5. **Anchor nav backdrop blur**: 12px is the proposed value; verify legibility against the busiest section (Section 2.3 system diagram) before locking.
6. **Type licensing**: confirm Source Serif 4 ships at the four weights needed (380, 420, 500, 600). If not, drop to nearest variable-font axis values. Tiempos / GT Sectra fallback only if explicit license available.
7. **Coral exact value**: `oklch(64% 0.16 35)` is the neighborhood per DESIGN.md. Lock the literal value during craft after testing against cream + against charcoal under multiple monitor calibrations.
