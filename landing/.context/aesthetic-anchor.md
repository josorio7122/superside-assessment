# Aesthetic Anchor

Selected from 4 gpt-image-2 probes generated in `../scratch/aesthetic-probes/`. The chosen direction is **Probe 01 — Editorial** (`aesthetic-anchor.png` in this directory).

## What "Editorial" means here

A B2B platform landing register reminiscent of **Stripe.com** and **Linear.app** — restrained, confident, sophisticated. Reads as a serious product made by people who care about typography and whitespace.

## Concrete signals from the anchor image

- Background: warm cream, in the neighbourhood of `#faf9f5` (the Anthropic cream). Not pure white.
- Headlines: serif, calm, classical proportions. Generous line-height.
- Body: small sans-serif, dark warm-tinted neutral (not `#000`).
- Accent: one warm tone (the anchor uses an orange-coral). Used sparingly — primary CTA, key emphasis only.
- Layout: split hero (text left, product visual right). Generous whitespace. Vertical rhythm visible via deliberate spacing variations.
- Product visual: a real screenshot of restrained product UI on a desk surface — not a stylised illustration.
- Lower section: three short feature blurbs, each with a small icon and tight label.
- Nav: minimal, left-aligned wordmark, right-aligned links + sign-in + primary CTA.

## What to avoid (cross-checked against impeccable's bans)

- Pure black or pure white. Tint everything to the cream / charcoal warm axis.
- Gradient text. Use solid colour, vary weight or size for emphasis.
- Identical card grids. Vary card sizes, weights, alignments.
- Hero-metric template. If we show stats ("3 days → 5 min"), present them as editorial figures not big-number tiles.
- Side-stripe borders. Full borders or no borders.
- Modal as first thought. Inline / progressive everywhere.
- Em dashes in copy. Use commas, colons, or periods instead.

## Strategy

- **Color strategy:** Restrained — tinted cream + charcoal neutrals + one warm accent ≤10%.
- **Theme:** Light. Justification: a hiring reviewer reads this on a desktop monitor in business hours; the calm cream-on-charcoal register matches the editorial promise and avoids the dark-mode-as-default cliché.
- **Type:** One serif (display / hero / section heads) + one sans-serif (body / nav / micro). Hierarchy via scale and weight contrast (≥1.25 ratio per step).
- **Motion:** Subtle. Section reveals on scroll using ease-out-quart or ease-out-quint. No bounce, no elastic. Animate `transform` and `opacity` only.

## Working name for the platform / brand

The platform is the architecture-case deliverable — **internal codename: Studio**. Open to revision during `/impeccable teach`.
