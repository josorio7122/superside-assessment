# Product

## Register

brand

> Primary surface is the brand landing (single-page, scroll-anchored). Section 2.2 embeds real React product mockups (Brands list, Brand-guideline editor, Generations history, Usage dashboard) — those screens follow the **product** register and inherit type/color tokens from the brand surface. Override register per task when working inside `src/components/mockups/*` or equivalent.

## Users

A single audience: the **Superside hiring panel** reviewing an architecture-case assessment. Senior product engineers, architects, and hiring managers reading on a desktop monitor during business hours.

Their context: limited time, high signal-to-noise expectation, allergy to generic SaaS copy. Their job to be done is to evaluate one candidate's clarity of thought, consistency of decisions, justified trade-offs, short-term-vs-long-term thinking, and whether the candidate can ship product, not just specs.

Secondary use: the candidate (Jose) shares the URL after the panel as a portfolio artifact.

## Product Purpose

`Studio` is the working name for the architecture-case deliverable: a platform that lets designers work with AI-generated, brand-true creative directly inside Figma. The landing exists to **present that deliverable as a finished product**, not to describe it.

What the page does:

1. State the problem (DesignTechCo's 3-day localisation lag, 25 brands × 8 locales governance drift, designers leaving Figma to hunt stock).
2. Show the solution: features, real mockup screens, system diagram, data flow.
3. Argue the engineering case: dev effort, short-term impact, long-term impact, phased roadmap, risks.

Success looks like: the panel walks away with both **design polish** and **architectural rigor** registered equally. Neither lead — both must read as senior-product-engineer-grade.

## Brand Personality

Three words: **restrained, confident, sophisticated**.

Voice: editorial. Calm, classical, opinionated without being loud. Reads as a serious product made by people who care about typography and whitespace. Closer to Stripe.com / Linear.app / Anthropic than to Vercel / Framer / typical AI-tool marketing.

Emotional goal on first scroll: *this person ships*. On deep read: *and they thought about the trade-offs*.

## Anti-references

Avoid:

- **Generic SaaS landing copy** ("Boost your team's productivity!", "Unlock the power of AI", "Built for modern teams"). Every claim must be specific and tie back to a source doc.
- **AI aesthetic clichés**: purple-to-blue gradients, neural-network mascots, "powered by AI" badges, neon-on-black, glow effects, holographic / iridescent surfaces.
- **The hero-metric template**: big number, small label, gradient accent, three-stat row. If we show "3 days → 5 min", present it as editorial figures inside prose, not as a stat tile.
- **Identical card grids**: same-sized cards with icon + heading + text repeated endlessly. Vary card sizes, weights, alignments.
- **Side-stripe borders**: no `border-left: 4px solid accent` accents. Full borders or no borders.
- **Em dashes** in copy. Use commas, colons, periods, or parentheses. Also not `--`.
- **Stock-photo aesthetic**: no people-on-laptop hero photography, no abstract neural-net illustrations, no 3D blob renders.
- **Modal as first thought**: inline / progressive everywhere.

Specific aesthetic lanes to reject (second-order reflex): the "AI workflow tool" lane (purple gradient + dark navy), the "B2B SaaS landing" lane (cream + sans + subtle drop shadow + identical feature cards). Editorial-typographic done well, not editorial-as-veneer-on-SaaS.

## Design Principles

1. **Show, don't tell.** The page itself is evidence of execution. Real React mockups, not screenshots. Real type system, not Figma exports. The medium IS the argument.
2. **Evidence, not slogans.** Every claim ties back to a source doc in the repo root (`assessment.md`, `architecture.md`, `roadmap.md`, etc.). If a sentence could appear on any AI-tool landing page, rewrite it or cut it.
3. **Trade-offs visible.** Decisions are stated, not hidden. Short-term vs. long-term, MVP vs. Beta vs. Full, what ships vs. what's deferred, why one OpenAI provider with no fallback in MVP. The reviewer should see the reasoning, not just the result.
4. **Editorial restraint.** Calm cream/charcoal, generous whitespace, type and rhythm carry the message. Color and motion are scarce by design — when used, they mean something.
5. **The product touches AI; the page does not advertise it.** No "Powered by GPT-4o" badges. No glowing AI signifiers. The audience knows what the product is; the page proves the candidate can build it.

## Accessibility & Inclusion

Target: **WCAG 2.2 AA**.

- Body copy contrast ≥ 4.5:1 against the cream background. Large text and UI components ≥ 3:1.
- Full keyboard navigation: visible focus rings on all interactive elements (anchor links, nav, mockup controls), logical tab order, skip-to-content link.
- `prefers-reduced-motion: reduce` honoured: scroll-reveal animations and any transform-based motion collapse to opacity-only or are disabled entirely.
- Color is never the only carrier of information (charts, status indicators, etc. also use shape, label, or position).
- Mermaid system diagram: provide a text-equivalent summary or `<figcaption>` describing the components and flow for screen-reader users.
- Real focus management inside the React mockup islands — do not trap focus, do not steal it on mount.
