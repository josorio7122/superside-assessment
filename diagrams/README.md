# Architecture diagrams · companion deck

Single Excalidraw file with 15 frames laid out as a vertical scroll. Captions per frame, restrained palette matching the landing site (cream / coral / charcoal / stone).

## File

- `architecture.excalidraw` — source. 328 elements, 15 frames.
- `out/` — rendered PNGs (run the render command below to populate).

## Frames

| # | Frame | Topic |
|---|-------|-------|
| 01 | System architecture (master topology) | Three-column overview · clients · auth+server+db · async+models+storage |
| 02 | Sync text flow (copy + translation) | Single round trip · ≤2s p50 |
| 03 | Image generation flow (async) | BullMQ + Redis pub/sub + SSE · p95 ≤20s |
| 04 | Brand profile upload + extract | Mandatory human review before publish |
| 05 | Brand-guideline lifecycle | State machine · uploaded → published · rollback as flag flip |
| 06 | RBAC enforcement | WorkOS Roles × user_brand mapping · scope check at every router |
| 07 | Async job state machine | BullMQ retry · stalled-job recovery · idempotency_key |
| 08 | Plugin runtime (two-thread) | Main thread sandbox + UI iframe · postMessage bridge |
| 09 | Tech decisions matrix | Every load-bearing pick · alternatives · why pick won |
| 10 | Runtime: Why Node + TypeScript | Five axes vs Python and Go |
| 11 | Worker concurrency + scaling | BullMQ knobs · OpenAI-bound work · queue-depth autoscale |
| 12 | LLM proxy + provider routing | packages/ai · MVP→Beta multi-provider via PostHog flags |
| 13 | Observability + eval gates | PostHog single platform · publish gate on brand-profile flip |
| 14 | Data model (Postgres ER) | org / user / user_brand / brand / brand_profile / generation / usage_event / usage_daily |
| 15 | Analytics scaling decision | Week-6 audit · skip rollups / build rollups / migrate to ClickHouse |

## How to view

**Excalidraw web app (easiest):**

1. Open https://excalidraw.com
2. File → Open → pick `architecture.excalidraw`
3. Scroll vertically through the 15 frames

**Excalidraw desktop app:**

```
brew install --cask excalidraw
open -a Excalidraw architecture.excalidraw
```

**Render to PNG locally:**

```bash
cd ~/.claude/skills/excalidraw-diagram/references
uv run python render_excalidraw.py /Users/josorio/Code/superside/diagrams/architecture.excalidraw
```

PNG lands next to the source file. (Note: first render fetches Excalidraw module from esm.sh — needs ~30s with warm cache, longer cold.)

## Palette

| Token | Hex | Use |
|-------|-----|-----|
| cream | `#f5f3ed` | canvas background |
| charcoal | `#2a2622` | primary ink |
| reading | `#4a4642` | body text |
| stone | `#7e7a74` | secondary ink, hairlines |
| hairline | `#cdc9c0` | dividers |
| coral | `#e16b3f` / `#c25729` | accent · the only piece running our code |
| coral fill | `#f7d6c5` | accent shape fills |

Path-overlay colors (data flows):

| Color | Hex | Flow |
|-------|-----|------|
| coral | `#e16b3f` | sync text (copy + translation) |
| teal | `#5a8c7a` | image generation (async) |
| ochre | `#b8893a` | brand profile upload + extract |

## Cross-references

Source documents in repo root:

- `architecture.md` — overall arch + components + data stores + multi-tenant
- `roadmap.md` — phased plan, MVP / Beta / Final Rollout, risks
- `data-flow.md` — E2E walkthrough
- `data-model.md` — Postgres schema, indexes
- `engineering.md` — coding conventions, monorepo layout
- `tooling.md` — locked stack
- `features.md` — user-facing capabilities by surface
- `designs/` — per-feature designs
- `research/figma-plugin.md` — plugin runtime constraints
- `landing/` — Astro landing site (see https://josorio7122.github.io/superside-assessment/)
