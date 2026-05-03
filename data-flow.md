# Data Flow — "Localise copy & replace images"

End-to-end walkthrough of the scenario the assessment specifically calls out: a designer in Figma triggers both text translation and image generation on a selected ad template.

## Scenario

A designer at DesignTechCo opens a Figma template — a square ad for the **Slack** brand laid out with placeholder English copy and a stock-photo image fill. They want to localise it into Spanish and swap the placeholder for a brand-aligned generated image before continuing.

Concretely, they:

1. Select the three text layers (`Headline`, `Subhead`, `CTA`) and a frame with an image fill (`hero-image`).
2. Trigger **"Translate to Spanish"** from the plugin.
3. Trigger **"Generate image"** with a short prompt ("modern team collaboration, sunlit office") on the hero-image frame.
4. Pick one of the three returned image variants and apply it.
5. Continue editing.

## Preconditions

- Designer is signed in (bearer token in `figma.clientStorage`; `userId` and `orgId` resolvable on every request).
- The Slack brand has a published `brand_profile` (`status=ready`, `is_current=true`) with both voice and visual sections populated.
- The plugin manifest whitelists the API, S3, and auth domains.
- The brand profile has Spanish in `localization` (locale notes for `es`); if missing, the model falls back to its own knowledge — translation still works, locale-specific tone is just less polished.

## End-to-end sequence

```mermaid
sequenceDiagram
    actor D as Designer
    participant FP as Figma Plugin (UI iframe + main)
    participant H as Hono API
    participant W as WorkOS
    participant PG as Postgres
    participant Q as BullMQ + Redis
    participant Wk as Worker
    participant OAI as OpenAI (GPT-5.1 + gpt-image-2)
    participant S3 as S3
    participant SSE as SSE channel

    Note over D,FP: Designer opens template, picks Slack as active brand,<br/>selects 3 text layers + hero-image frame

    rect rgb(230, 242, 255)
      Note over D,SSE: Step 1 — Localise copy (synchronous, ≤ 2 s)

      D->>FP: clicks "Translate to Spanish"
      FP->>FP: read selected text layers (id, name, text, charLimit)
      FP->>H: POST /api/generations/translations<br/>{ brandId, layers[], targetLocale: "es" }<br/>Authorization: Bearer ...
      H->>H: auth middleware → resolve (userId, orgId)
      H->>W: validate session
      W-->>H: ok
      H->>PG: SELECT brand_profile WHERE brand_id=? AND is_current=true
      PG-->>H: profile row (Slack v3, status=ready)
      H->>PG: INSERT generation (type=translate, status=running, input)
      H->>H: assemble prompt (voice block + locale_notes["es"] + char_limits)
      H->>OAI: chat.completions.create({ model: "gpt-5.1", messages, response_format: json_schema })
      OAI-->>H: { layers: [{ id, text }, ...] }
      H->>PG: UPDATE generation SET output=..., status=done
      H->>PG: INSERT usage_event (provider=openai, model=gpt-5.1, tokens, cost, latency)
      H-->>FP: 200 { generationId, layers[] }
      FP->>FP: postMessage to main thread
      FP->>FP: figma.loadFontAsync(...) per layer<br/>node.characters = translated text
      Note over FP: 3 text layers updated; designer sees Spanish copy
    end

    rect rgb(255, 240, 220)
      Note over D,SSE: Step 2 — Replace image (async, ~3–6 s)

      D->>FP: selects hero-image frame, types prompt, clicks Generate
      FP->>H: POST /api/generations/images<br/>multipart { meta, mode: "text" }<br/>Authorization: Bearer ...
      H->>H: auth → (userId, orgId), validate, resolve brand profile
      H->>PG: INSERT generation (type=image, status=pending,<br/>figma_file_key, figma_node_id)
      Note over PG: partial unique index enforces<br/>per-node lock for type=image
      PG-->>H: ok
      H->>Q: enqueue image-generate { generationId }
      H-->>FP: 202 { generationId }
      FP->>SSE: open EventSource /api/generations/:id/events

      Q->>Wk: dispatch job
      Wk->>PG: SELECT generation + brand_profile
      Wk->>Wk: assemble prompt (user prompt + visual block:<br/>palette, mood, composition, avoid)
      Wk->>OAI: images.generate({ model: "gpt-image-2", prompt, n: 3, size: "1024x1024" })
      OAI-->>Wk: 3 images (base64 bytes inline)
      loop per variant
        Wk->>S3: putObject generations/<orgId>/<genId>/<i>.png
      end
      Wk->>PG: UPDATE generation SET output={ variants: [...] }, status=done
      Wk->>PG: INSERT usage_event (provider=openai, model=gpt-image-2, latency, cost)
      Wk->>Q: publish completion to Redis pub/sub
      Q-->>SSE: forward event
      SSE->>FP: event: image.ready { variants: [{ index, signedUrl, expiresAt }] }

      FP->>D: render 3 thumbnails
      D->>FP: picks variant 1
      FP->>FP: postMessage to main thread { selectedUrl }
      FP->>FP: figma.createImageAsync(selectedUrl) → image handle
      FP->>FP: heroImage.fills = [{ type:'IMAGE', imageHash, scaleMode:'FILL' }]
      Note over FP: Selected variant applied to the frame
    end

    Note over D,FP: Designer continues editing
```

## What happens at each component

### Plugin (Figma)

- The UI iframe handles network and SSE; the main thread reads and writes Figma layers via the `figma` global. They communicate via `postMessage`.
- For translate: reads `node.characters`, `node.name`, `node.fontSize`, `node.width`, `node.textAutoResize` per selected layer to compute a `charLimit` hint.
- For image (text-to-image mode in this scenario): reads only the selected node id; no bytes uploaded. Image-to-image mode would also call `node.exportAsync({ format: 'PNG' })` and include the bytes in the multipart body.
- Bearer token from `figma.clientStorage` is attached to every API call.
- After `createImageAsync` runs, Figma caches the bytes by `imageHash` — the signed URL can later expire without breaking the rendered fill.

See `research/figma-plugin.md` for the constraints behind this design.

### API (Hono)

- One auth middleware accepts both bearer (plugin) and cookie (admin web) sessions; both resolve to `(userId, orgId)`.
- Zod validates payload shape; `org_id` is the implicit filter on every read.
- Translate is **synchronous** — single OpenAI round-trip plus DB writes inside the request; designed to fit ≤2s p50.
- Image is **asynchronous** — the API inserts the row, enqueues the job, and returns 202 immediately. The partial unique index on `(org_id, figma_file_key, figma_node_id) WHERE type='image' AND status IN ('pending','running')` is the per-node lock.

### Orchestration (BullMQ + worker)

- Worker pulls the job from Redis, loads the `generation` row plus the active `brand_profile`, and assembles the image prompt by concatenating user input with the brand visual block (palette hexes, mood descriptors, composition rules, "avoid" list).
- Calls OpenAI `gpt-image-2` with `n=3`. One round trip returns three images inline as base64 bytes.
- Uploads each variant to S3 under `generations/<orgId>/<genId>/<i>.png`.
- Updates the `generation` row with `status=done` and `output.variants`. Writes one `usage_event`.
- Publishes a completion event to a Redis pub/sub channel.

### SSE channel

- The API's SSE endpoint subscribes to the same Redis channel for the org and forwards events to the connected plugin tab.
- One connection per active page; idle heartbeat every 30s.
- If the plugin closes mid-job, the worker still completes — the result is just retrievable from the generations history later.

### Postgres

- Holds the audit trail (`generation` row), the cost/latency atom (`usage_event`), and the brand profile that grounds the prompt.
- All reads scoped by `org_id` from the request context.

### S3

- Stores generated images, uploaded image-to-image inputs, and source brand-guideline PDFs.
- Forever retention in MVP.
- Signed GET URLs (1h TTL) gate client access. The plugin manifest whitelists the bucket domain.

### WorkOS

- Out of the request path for steady-state — only consulted on session validation.
- Identity is mirrored locally: WorkOS Org ↔ `org`; WorkOS User ↔ `user`. JIT provisioning on first sign-in.

### Models

- **OpenAI GPT-5.1** for translation. Successor to GPT-4o, qualifies as the "GPT-4o or equivalent" tier the assessment calls for. Cheaper than GPT-4o, with strong cached-input pricing for our reusable brand voice block.
- **OpenAI `gpt-image-2`** for image. Typical <3s latency, ≥99% text-rendering accuracy, native multi-image-per-request, supports image-as-input via `images.edit`.
- No fallback providers in MVP. Single OpenAI key for everything; same-provider retries handle transient errors.

## Latency at each step

| Step | Budget |
|------|--------|
| Translate request → response | ~1.5–1.8s p50 (fits N1) |
| Image POST → 202 (text mode) | ~50ms |
| Image worker → OpenAI → results | 2–4s p50 (`gpt-image-2`) |
| S3 upload of 3 outputs (bytes already in worker) | ~300–1500ms total |
| SSE event delivery | <100ms |
| **Total image flow end-to-end** | **~3–6s p50, ~10s p95** |
| Designer applies variant in Figma | <500ms |

## What if it fails?

| Failure | Behavior |
|---------|----------|
| Translate: OpenAI 5xx | Retry once on the same provider; if it fails again, return 502; plugin shows error toast; `generation.status='failed'` recorded. |
| Image: OpenAI timeout / 5xx | BullMQ retries 3× with exponential backoff. After exhaustion, `generation.status='failed'`, SSE pushes `image.failed`, plugin shows "Retry" affordance. |
| Brand profile not ready | API returns 409. Plugin nudges the user to the admin web to upload or fix the guideline. |
| Per-node lock conflict | API returns `409 PER_NODE_LOCK` with the in-flight `generationId`. Plugin subscribes to that SSE instead of starting a new job. |
| Auth token expired | API returns 401. Plugin re-runs the OAuth flow (silent if WorkOS still has the IdP session). |
| Plugin closed mid-job | Worker still completes; image is stored. The designer sees the result in the admin web's generations history (and once the plugin design pass lands, in the plugin's recent generations panel). |

## What this scenario demonstrates

- The two-latency-class architecture in action: synchronous ≤2s text path, asynchronous + SSE image path.
- Brand grounding via the structured `brand_profile` for both text and image, with the voice section feeding text prompts and the visual section feeding image prompts.
- Multi-tenant scoping via `org_id` on every read and write, with no per-tenant infrastructure.
- Cost attribution via `usage_event` written for every model call, supporting per-user and per-org dashboards.
- Per-node concurrency control via a partial unique index on `generation`, preventing duplicate image jobs on the same Figma node.
- The Figma plugin's two-thread model: UI iframe handles network and SSE; main thread mutates layers via the `figma` global.
