# Design process artifacts

Working artifacts behind the landing site's visual design. Generated during `/impeccable shape` and `/impeccable craft` runs. Kept here for transparency — they show how the page was scoped before any code was written.

## Files

| File | Purpose |
|------|---------|
| `aesthetic-anchor.md` | Selected visual direction (Probe 01 — Editorial). Cream background, serif headlines, restrained palette, one warm accent ≤10%. Stripe / Linear / Anthropic register. |
| `aesthetic-anchor.png` | The reference image generated as visual probe input. Drove palette + spacing + mood decisions. |
| `shape-brief-landing.md` | Confirmed shape brief from `/impeccable shape landing` — page sections, content sources, mockup decisions, audience, what to skip. |
| `source-docs.md` | Map of source-doc markdown (in `../../docs/`) to landing sections. Every claim on the landing traces to a source doc here. |

## How to read in order

1. **`source-docs.md`** — what content is the page summarising and where does each claim live.
2. **`aesthetic-anchor.md`** + the PNG — what the page *looks* like and why.
3. **`shape-brief-landing.md`** — what was decided to ship vs skip.

These artifacts predate the code in `../src/`. The code is what those decisions produced.

## Not loaded by the build

These files are documentation. Astro doesn't read them. Safe to delete; only the design skill (`/impeccable`) needs them.
