# AGENTS.md

## Design Context

Authoritative design context lives in **`PRODUCT.md`** (strategic) and **`DESIGN.md`** (visual, when generated). Read both before any UI work.

### Quick reference

- **Register**: `brand` (landing). React mockups under `src/components/mockups/*` follow `product` register, inherit tokens.
- **Audience**: Superside hiring panel. Senior engineers/architects on desktop, business hours.
- **Personality**: restrained, confident, sophisticated. Stripe / Linear / Anthropic register, not Vercel / Framer / AI-tool marketing.
- **Color strategy**: Restrained — tinted cream (`~#faf9f5`) + warm-tinted charcoal + one warm accent ≤10%. Light theme only.
- **Type**: One serif (display) + one sans (body). Hierarchy via scale + weight, ≥1.25 ratio per step.
- **Motion**: Subtle. `transform` / `opacity` only. Ease-out-quart/quint. Honour `prefers-reduced-motion`.
- **A11y**: WCAG 2.2 AA. Keyboard-navigable. Focus rings visible. Color never sole carrier.

### Design principles (non-negotiable)

1. Show, don't tell — page IS the argument.
2. Evidence, not slogans — every claim ties to a source doc in repo root.
3. Trade-offs visible — state decisions, don't hide them.
4. Editorial restraint — type and rhythm carry message.
5. Product touches AI; page does not advertise it.

### Hard bans

- No purple-blue gradients, neural-net mascots, "powered by AI" badges, glow / aurora.
- No hero-metric template (big number + small label + gradient).
- No identical card grids. No side-stripe borders. No gradient text. No glassmorphism by default.
- No em dashes in copy. Use comma, colon, semicolon, period, parentheses.
- No modal as first thought. Inline / progressive.
- No `#000` / `#fff`. Tint everything to brand hue.

### Source-of-truth docs

| File | Use for |
|---|---|
| `PRODUCT.md` | Strategic context (users, purpose, principles, anti-refs). |
| `DESIGN.md` | Visual system (colors, type, components). Generate via `/impeccable document`. |
| `.context/aesthetic-anchor.md` | Selected visual direction + rationale (Probe 01 Editorial). |
| `.context/source-docs.md` | Map of repo-root markdown to landing sections. |
| `../assessment.md` → `../roadmap.md` | Authoritative content. Every claim traces here. |

### Commands

- `/impeccable shape <feature>` — plan UX/UI before code.
- `/impeccable craft <feature>` — shape + build end-to-end.
- `/impeccable critique` / `audit` / `polish` — review and refine.
- `/impeccable document` — regenerate DESIGN.md from current code.

Refresh context (`node /Users/josorio/.claude/plugins/cache/impeccable/impeccable/3.0.6/skills/impeccable/scripts/load-context.mjs`) at session start, after editing PRODUCT.md or DESIGN.md, or after `/impeccable teach` / `document`.
