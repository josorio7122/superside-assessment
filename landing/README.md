# Studio · Landing site

Single-page Astro site that walks a reviewer through the architecture-case deliverable. Live at **<https://josorio7122.github.io/superside-assessment/>**.

The site is the surface; the substance lives in the source markdown at `../docs/` and the Excalidraw companion deck at `../diagrams/`.

## Stack

- **Astro 6** static output (no SSR, no server runtime)
- **Tailwind v4** via `@tailwindcss/vite`
- **TypeScript**
- Vanilla JS for interaction (IntersectionObserver scroll reveal, hash-deep-linked mockup tabs)
- No React framework runtime — components compile to static HTML/CSS

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # static output → dist/
pnpm preview      # preview the built site
```

Node ≥ 22.12 (per `package.json`).

## Layout

```
src/
├── components/
│   ├── Hero.astro · Header.astro · Footer.astro
│   ├── MockupTabs.astro · SystemDiagram.astro · Roadmap.astro
│   └── mockups/        Inert UI screenshots frozen on representative state
├── layouts/Layout.astro    Document shell + scroll-reveal observer
├── pages/index.astro       Single page; three numbered sections
└── styles/global.css       Tailwind v4 @theme tokens (OKLCH)
```

## Design context

The landing was shaped via the [`/impeccable`](https://github.com/seanlinsley/impeccable) design skill. Context files at the root of this directory drive that workflow:

| File | Purpose |
|------|---------|
| `PRODUCT.md` | Strategic context — users, brand, tone, anti-references |
| `DESIGN.md` | Visual system — color, type, components |
| `AGENTS.md` | Quick-reference guide for design agents working in this directory |
| `design-process/` | Aesthetic anchor + shape brief + source-doc map (the working artifacts behind the design) |

If you're not running `/impeccable`, ignore those files — they don't affect the build.

## Deploy

GitHub Action at `../.github/workflows/deploy.yml` builds + ships to GitHub Pages on every push to `main` that touches `landing/**`. Deploys to the project page subpath `/superside-assessment/` (configured via `astro.config.mjs` `base`).

## Conventions

- Restrained palette, OKLCH tokens, no gradients on text or shapes
- No emojis (system-wide); typography carries hierarchy
- All claims trace to a source doc in `../docs/`
