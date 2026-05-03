<!-- SEED — re-run /impeccable document once there's code to capture the actual tokens and components. -->
---
name: Studio
description: Architecture-case landing presenting a brand-true AI creative platform for designers in Figma.
---

# Design System: Studio

## 1. Overview

**Creative North Star: "The Architecture Brief"**

Studio's landing is an executive-summary memo addressed to senior reviewers. It looks the way a senior product engineer thinks: type-led, evidence-cited, decisions visible, ornamentation absent. The reader should feel they are holding a finished document, not browsing a marketing page. Polish is the argument; nothing is decorative.

The system is restrained by doctrine. One serif sets the headline voice. One sans carries everything else. One warm accent appears on roughly one in ten elements and means something every time. Whitespace is generous, vertical rhythm is deliberate, and color is scarce. The page is closer to a Stripe documentation index or an Anthropic essay than to any AI-tool marketing surface. It is explicitly NOT Vercel-generic, NOT Framer-template, and never advertises the AI underneath.

Every claim on the page traces to a source document in the repo root. Every visual choice traces to this file. The medium IS the argument: the same person who writes the architecture writes the type system.

**Key Characteristics:**
- Editorial restraint: type and rhythm carry the message, not color or motion.
- One warm accent ≤10% of any surface. Used for primary CTA, key emphasis, anchor-link active state.
- No `#000`, no `#fff`. Every neutral tinted toward the warm cream / warm charcoal axis.
- Light theme only. The reviewer reads on a desktop monitor in business hours; dark mode is not a default here.
- Real components, not screenshots. Mockup screens are React, not images.
- Motion is invisible until used. State changes only. `transform` + `opacity`. `prefers-reduced-motion` honoured.

## 2. Colors

A warm cream-and-charcoal neutral axis with one coral-orange accent. Tinted, never neutral-grey; warm, never cold-blue. The palette is short by design. If a color does not earn its place by carrying meaning, it does not appear.

### Primary

- **Editorial Coral** (`oklch(64% 0.16 35)` neighborhood, exact value `[to be resolved during implementation]`): the single warm accent. Reserved for the primary CTA, the active state on anchor navigation, and one or two key-emphasis runs in editorial copy. Never on body text. Never on backgrounds larger than a button. Coral, not red, not orange — sits between, slightly muted, never neon.

### Neutral

- **Warm Ash Cream** (`oklch(97.5% 0.005 60)` neighborhood, exact value `[to be resolved]`): the canvas. Anthropic-adjacent cream. Carries roughly 90% of the page surface.
- **Editorial Charcoal** (`oklch(20% 0.01 50)` neighborhood, exact value `[to be resolved]`): primary text and headlines. Warm-tinted toward the cream axis so headline/background contrast feels of-a-piece, not stark.
- **Reading Charcoal** (`oklch(35% 0.008 50)` neighborhood, exact value `[to be resolved]`): body copy and secondary prose. One step lighter than headline charcoal for lower-weight reading rhythm.
- **Quiet Stone** (`oklch(55% 0.005 50)` neighborhood, exact value `[to be resolved]`): captions, metadata, source-doc citations, table of contents. The quietest level that still meets WCAG AA against cream.
- **Hairline** (`oklch(85% 0.005 50)` neighborhood, exact value `[to be resolved]`): horizontal rules, table dividers, full borders on the rare card.

### Named Rules

**The One Voice Rule.** Editorial Coral appears on no more than 10% of any rendered viewport. Its rarity is the point. The first time the reader sees it, the eye should know to look.

**The Tinted Neutral Rule.** No `#000`, no `#fff`, ever. Every neutral carries at least 0.005 chroma toward the warm hue axis. Pure black or pure white reads as cold and wrong against the cream.

**The Functional Color Rule.** Color carries meaning, not decoration. Status indicators (success, warning, error) are introduced only when a component actually needs them, never to add visual interest.

## 3. Typography

**Display Font:** Source Serif 4 (variable), with `Tiempos`, `GT Sectra`, `Georgia` as fallback. `[font pairing finalised at implementation — Source Serif is the recommended free-tier pick; swap to Tiempos or GT Sectra if licensing permits.]`

**Body Font:** Inter (variable), with `system-ui`, `-apple-system`, `Segoe UI` as fallback.

**Label/Mono Font:** JetBrains Mono, with `ui-monospace`, `SFMono-Regular` as fallback. Used for source-doc filenames, code excerpts, and figure callouts in the system diagram section.

**Character:** the serif is editorial without being romantic. Calm proportions, low contrast, comfortable at every size from inline emphasis to display headline. The sans is neutral and legible, never showy. The pairing reads as a serious longform essay, not as a magazine cover.

### Hierarchy

- **Display** (Serif, weight 380, `clamp(3rem, 6vw, 5.25rem)`, line-height 1.05, letter-spacing -0.015em): hero headline only. One per page.
- **Headline** (Serif, weight 420, `clamp(2rem, 3.5vw, 2.75rem)`, line-height 1.1, letter-spacing -0.01em): section openers (Problem, Solution, Development effort, Short-term, Long-term).
- **Title** (Sans, weight 600, `1.25rem`, line-height 1.3, letter-spacing -0.005em): subsection headings inside long sections, mockup captions, callout titles.
- **Body** (Sans, weight 400, `1.0625rem`, line-height 1.65, letter-spacing 0): paragraph text. Max line length 65–72ch. Never edge-to-viewport.
- **Reading** (Sans, weight 400, `0.9375rem`, line-height 1.6): secondary prose, figure descriptions, mockup explanations.
- **Label** (Sans, weight 500, `0.75rem`, line-height 1.4, letter-spacing 0.06em, uppercase): section eyebrows, metadata, source-doc tags, nav links.
- **Mono** (Mono, weight 400, `0.875rem`, line-height 1.5): inline filenames, code snippets, figure-numbering callouts on the system diagram.

### Named Rules

**The Scale-and-Weight Rule.** Hierarchy comes from scale + weight contrast at a ≥1.25 ratio between adjacent steps. Color shifts and underlines are not hierarchy mechanisms.

**The Reading Width Rule.** Body copy is capped at 65–72ch. Section paragraphs sit in a centered measure inside a wider editorial gutter. The page is never edge-to-edge prose.

**The No-Decorative-Type Rule.** Gradient text, text-shadow, letterpress, stroke effects, and animated text reveals beyond opacity-fade are forbidden. Emphasis comes from weight (semibold), italic, or color (Editorial Coral on rare runs).

## 4. Elevation

Studio is **flat by default**. Depth is conveyed through tonal layering on the cream axis (cream → slightly warmer cream for a sunken section), not through drop shadows. The single exception is the floating mockup chrome: the React mockup screens in section 2.2 sit on a faint, ambient shadow to read as physical product surfaces against the editorial canvas.

### Shadow Vocabulary

- **Mockup Ambient** (`box-shadow: 0 1px 2px oklch(20% 0.01 50 / 0.04), 0 12px 32px oklch(20% 0.01 50 / 0.08)`): the only structural shadow. Reserved for the mockup-screen container and any overlaid mockup popovers.
- **Focus Ring** (`box-shadow: 0 0 0 3px oklch(64% 0.16 35 / 0.35)`): keyboard-focus indicator. Coral at low opacity, on every focusable element.

### Named Rules

**The Flat-By-Default Rule.** Cards, sections, and dividers do not float. Use full borders, background tonal shifts, or whitespace before reaching for a shadow.

**The Mockup Exception Rule.** Only the section 2.2 React mockup screens carry an ambient shadow, because they are presented as physical product artifacts on the editorial canvas. Nothing else floats.

## 5. Components

`[Components are deferred — no library exists yet. Re-run /impeccable document after the first build pass to extract and document button, nav, mockup-frame, callout, and footnote-link primitives. Until then, follow the Colors / Typography / Elevation rules above and the Do's and Don'ts below when synthesizing primitives.]`

## 6. Do's and Don'ts

### Do:

- **Do** tint every neutral toward the warm cream / warm charcoal axis. `oklch` chroma 0.005–0.01 is enough.
- **Do** reserve Editorial Coral for the primary CTA, anchor-active state, and key-emphasis runs. ≤10% of any viewport.
- **Do** carry hierarchy through scale and weight contrast at a ≥1.25 ratio between steps.
- **Do** cap body line length at 65–72ch.
- **Do** use full borders or no borders on cards and callouts.
- **Do** vary card sizes, weights, and alignments. If multiple cards exist, each should earn its dimensions.
- **Do** present the mockup screens as real React components on a faint ambient shadow.
- **Do** animate `transform` and `opacity` only, with ease-out-quart or ease-out-quint, ~300–450ms.
- **Do** honour `prefers-reduced-motion: reduce` by collapsing motion to opacity-only or disabling it.
- **Do** trace every visible claim back to a source doc in the repo root (`assessment.md`, `architecture.md`, `roadmap.md`, etc.).

### Don't:

- **Don't** use `#000` or `#fff`. Pure black/pure white is forbidden — every neutral carries warm chroma.
- **Don't** use purple-to-blue gradients, neural-network mascots, "powered by AI" badges, neon-on-black, glow effects, or holographic / iridescent surfaces. PRODUCT.md anti-reference: Vercel / Framer / typical AI-tool marketing.
- **Don't** ship the hero-metric template (big number + small label + gradient accent + three-stat row). If you need to show "3 days → 5 minutes", set it as editorial figures inside prose, not a stat tile.
- **Don't** ship identical card grids. Same-sized icon + heading + paragraph cards repeated three or four times across is forbidden.
- **Don't** use side-stripe borders (`border-left: 4px solid accent` or similar) as a colored accent on cards, lists, callouts, or alerts. Full borders or no borders.
- **Don't** use gradient text (`background-clip: text` over a gradient). Solid color, vary weight or size for emphasis.
- **Don't** use glassmorphism (backdrop blurs, glass cards) decoratively. The system is flat and the canvas is opaque.
- **Don't** reach for a modal as the first thought. Inline / progressive everywhere.
- **Don't** use em dashes in body copy. Use commas, colons, semicolons, periods, or parentheses. Also not `--`.
- **Don't** use stock people-on-laptop hero photography, abstract neural-net illustrations, or 3D blob renders.
- **Don't** advertise AI on the page. The product touches AI; the landing does not. No "Powered by GPT-4o" badges, no glowing AI signifiers.
- **Don't** ship dark mode. Light cream is the only theme on this surface.
- **Don't** generic-SaaS the copy ("Boost productivity", "Unlock the power of AI", "Built for modern teams"). Every claim is specific and traces to a source doc.
