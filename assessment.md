# AI Consulting Lead Product Engineer — Architecture Case Assessment

## Background

DesignTechCo is a global digital-commerce group that manages marketing for **25 consumer brands** across web, mobile and out-of-home channels. Their **10-person in-house Creative Studio** builds thousands of ad variants per month, primarily in **Figma**. Marketing leadership believes generative AI can speed up localisation and visual iteration, but they lack an integrated workflow.

Superside has been asked to explore a solution that will:

- Replace or localise copy in existing design templates while respecting each brand's tone of voice.
- Generate on-brand imagery placeholders to accelerate visual experimentation.
- Operate as an **internal tool first** (pilot on 10-person), with potential to scale to multiple clients with **+100 concurrent users**.

## Key Pain Points

- Manual copy localisation causes **3-day turnaround delays**.
- Designers manually search stock or Midjourney for placeholder images → breaks focus & version control.
- Brand governance is inconsistent when multiple language markets and visual styles collide.
- Creative Ops team needs reporting on AI usage and cost per asset.

## High-Level Requirements

### Functional

| ID | Requirement |
|----|-------------|
| F1 | Generate multiple variants of on-brand copy inside multiple text layers of a preset template |
| F2 | Auto-translate selected text layers into **8 locales** |
| F3 | Ingest brand guideline PDFs (≤ 10 MB) to inform tone & style prompts |
| F4 | Generate low-res image placeholders (**1024 × 1024**) compatible with design-tool fill layers |

### Non-Functional

| ID | Requirement |
|----|-------------|
| N1 | ≤ 2 s median round-trip latencies for single-sample operations |
| N2 | Secure access via SSO/OAuth |
| N3 | Designed for **5× traffic within 12 months** (25 → 125 designers) |
| N4 | Usage metering & cost attribution by user |
| N5 | **99% availability**, ability to roll out new versions to end customers within **< 12 h** |

## Known Constraints

- **Team & timeline:** 2 full-stack engineers, MVP in **< 10 weeks**.
- **Algorithm:** Limited to **GPT-4o or equivalent foundation models** licensed via API.
- **Architecture & Deployment:** Full freedom — must follow modern best practices for reliability, security, scalability, cost control.

## Assignment

Design an end-to-end technical architecture balancing:

- User experience & performance
- Development effort (2 full-stack engineers, ≤ 10 weeks)
- **Short-term impact (next 3 months)** — prove value quickly with existing user base
- **Long-term impact (12+ months)** — multi-tenant platform licensable to several companies with +100 concurrent users, minimized rework

### Deliverables / Be prepared to

- **Whiteboard / sketch component diagram:** client interface (Figma plugin), API layer, orchestration, model services, data stores, auth, monitoring.
- **Explain data flow** for a "localise copy & replace images" request.
- **Justify technology choices & trade-offs.**
- **Outline phased roadmap** (MVP, Beta, Full roll-out) with key risks & mitigations.

### Timebox

**48 hours** to complete and return deliverables.

## Disclaimer

Assessment is integral part of Superside hiring process. Not compensated. Results used solely to evaluate skills, not for company day-to-day business.
