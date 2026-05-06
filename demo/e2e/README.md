# @studio/e2e

Playwright end-to-end suite for the Studio demo.

## Suites

| Test file                  | Tag         | Purpose                                                                                       |
| -------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `tests/smoke.spec.ts`      | (default)   | Golden path: list -> detail -> edit chip -> save -> rollback                                  |
| `tests/extraction.spec.ts` | `@live`     | Real OpenRouter extraction of the seeded Slack PDF on a fresh brand                           |
| `tests/failure-retry.spec.ts` | (gated)  | Forced first-attempt failure -> retry -> ready (needs `FORCE_EXTRACT_FAIL=1` worker)          |
| `tests/visual.spec.ts`     | (default)   | Screenshot snapshot regression for /brands, brand-detail, /generations, /usage, /plugin       |
| `tests/a11y.spec.ts`       | (default)   | `@axe-core/playwright` on every route, fail on serious/critical                               |

## Run

```bash
# Default: smoke + visual + a11y, no LLM calls
pnpm --filter @studio/e2e test

# Include the live extraction test (costs OpenRouter tokens):
RUN_LIVE=1 pnpm --filter @studio/e2e test

# Failure-retry (separate run with a forced-fail worker):
#   Terminal A
cd landing/demo && FORCE_EXTRACT_FAIL=1 pnpm --filter @studio/worker dev
#   Terminal B
cd landing/demo && FORCE_EXTRACT_FAIL=1 RUN_LIVE=1 \
  pnpm --filter @studio/e2e test failure-retry
```

## Servers

`playwright.config.ts` declares api (3001) and web (5173) under `webServer`
with `reuseExistingServer: true`. If `pnpm dev` is already running, Playwright
reuses it; otherwise it spawns the processes for the duration of the run.

The worker has no HTTP port, so it is **not** managed here. For tests that
require a worker (`extraction.spec.ts`, `failure-retry.spec.ts`) start the
worker yourself via `pnpm --filter @studio/worker dev` before running the
suite.

## Visual snapshots

Playwright stores its assertion-grade snapshots under
`tests/visual.spec.ts-snapshots/` per platform/browser. These are committed
and any drift > `maxDiffPixelRatio: 0.02` fails the run.

Updating snapshots:

```bash
pnpm --filter @studio/e2e test visual -- --update-snapshots
```

These are the demo's reference snapshots; updating them requires a visual
review against the landing mockups in `landing/src/components/mockups/`.

The `e2e/baselines/` directory holds the **landing** mockup screenshots
(captured by `scripts/capture-mockup-baselines.ts`) for human side-by-side
comparison only — Playwright does not assert against them because the React
port lives in a different DOM tree, so pixel parity is approximate.
