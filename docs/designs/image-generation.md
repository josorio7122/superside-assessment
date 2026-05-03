# Image Generation

Backend design for the image-placeholder feature the Figma plugin invokes via `POST /api/generations/images`.

## Goals

- Generate **3 1024×1024 image variants** per request, grounded in the brand's visual identity (`brand_profile.visual`).
- Support **two modes**:
  - **text-to-image** — prompt + brand profile produce variants from scratch. **MVP scope.**
  - **image-to-image** — plugin exports a selected node to bytes, uploads with the request, model produces variants seeded by that input image. **Beta scope** — OpenAI's `images.edit` does not currently accept `gpt-image-2`; lands via fal.ai's `gpt-image-2/edit` endpoint when fal.ai integration ships in Beta.
- Run async — image generation latency is well outside the synchronous text budget.
- Persist generated images and uploaded inputs forever so they remain visible in the generations dashboard / history.
- Enforce a per-node lock — only one in-flight image generation per `(figmaFileKey, figmaNodeId)` at a time, regardless of mode.

## Non-goals (this design)

- **Image-to-image at MVP.** Moves to Beta with the fal.ai integration. Plugin UI exposes the mode but the action shows "available in Beta" until fal.ai ships.
- **Cross-provider fallback at MVP.** Beta lights up fal.ai as the image fallback in addition to image-to-image.
- **Aspect ratios other than 1024×1024** — locked for MVP (`gpt-image-2` supports more, but we don't expose it).
- **Content moderation server-side** — trust the provider.
- **Hard spend caps** — deferred.
- **Plugin "recent generations" panel** — backend already supports it via `GET /api/generations`; UX lives in the plugin design pass.
- **User-controlled fidelity / strength** for image-to-image — defaults from fal/`gpt-image-2/edit` only in Beta.

## Modes

| Mode | Request shape | Provider endpoint | Notes |
|------|---------------|-------------------|-------|
| `text` | `prompt` only | OpenAI `images.generate` (`gpt-image-2`) | New imagery from scratch |
| `image` | `prompt` + uploaded input image bytes | OpenAI `images.edit` (`gpt-image-2`) | Variants seeded by the input; brand profile still applied |

Both modes return 3 variants. Both go through the same `generation` row, the same per-node lock, and the same SSE notification flow.

## Actors

- **Figma plugin** — initiates the request, exports the source node bytes for image mode, opens SSE, applies the chosen variant via `figma.createImageAsync`.
- **Hono API** — validates, uploads input bytes to S3, persists, enqueues, surfaces signed URLs.
- **BullMQ worker** — runs the OpenAI call, uploads outputs to S3, updates the row.
- **OpenAI (`gpt-image-2`)** — generates the 3 images. Two endpoints depending on mode (`generate` for text-to-image, `edit` for image-to-image).
- **S3** — durable storage for uploaded inputs and generated outputs.

## Data model touches

Two new columns on `generation` to support the per-node lock and traceability (also documented in `data-model.md`):

| Field | Notes |
|-------|-------|
| `figma_file_key` | text, nullable |
| `figma_node_id` | text, nullable |

Index addition:

```sql
create unique index on generation (org_id, figma_file_key, figma_node_id)
  where type = 'image' and status in ('pending', 'running');
```

Source of truth for the per-node lock — concurrent inserts on the same `(org, file, node)` for an image generation collide at the DB.

`generation.input` for `type='image'`:

```jsonc
{
  "mode": "text" | "image",
  "prompt": "a person on a sunlit beach, editorial",
  "inputImageS3Key": "generation-inputs/<orgId>/<genId>/source.png", // image mode only
  "dimensions": { "width": 1024, "height": 1024 }
}
```

`generation.output` for `type='image'` when `status='done'`:

```jsonc
{
  "variants": [
    { "index": 0, "s3Key": "generations/<orgId>/<genId>/0.png", "width": 1024, "height": 1024 },
    { "index": 1, "s3Key": "generations/<orgId>/<genId>/1.png", "width": 1024, "height": 1024 },
    { "index": 2, "s3Key": "generations/<orgId>/<genId>/2.png", "width": 1024, "height": 1024 }
  ]
}
```

Signed URLs are not stored. They are regenerated on demand at read time (1-hour TTL).

## API

### `POST /api/generations/images`

**Content-Type: `multipart/form-data`**

Multipart is used because image mode includes binary bytes and we want a single round-trip from the plugin. Text mode also goes through this endpoint with no `inputImage` part — keeps client logic uniform.

**Form parts**

| Part name | Type | Required | Notes |
|-----------|------|----------|-------|
| `meta` | JSON string | yes | The fields below |
| `inputImage` | binary (PNG) | image-mode only | Up to ~5MB; rejected with `413` if larger |

**`meta` payload**

```jsonc
{
  "brandId": "uuid",
  "figmaFileKey": "string",
  "figmaNodeId": "string",
  "mode": "text" | "image",
  "prompt": "a person on a sunlit beach, editorial",
  "dimensions": { "width": 1024, "height": 1024 },
  "variantCount": 3
}
```

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `brandId` | yes | — | Must belong to caller's org with a `is_current=true` `brand_profile` |
| `figmaFileKey` | yes | — | Stored on `generation` |
| `figmaNodeId` | yes | — | Stored on `generation`; participates in per-node lock |
| `mode` | yes | — | `text` or `image` |
| `prompt` | yes | — | Free-text designer instruction |
| `dimensions` | no | `1024×1024` | Future-flexibility field; `422` if not exactly `1024×1024` in MVP |
| `variantCount` | no | `3` | Locked at `3` in MVP; `400` if other |

When `mode = 'image'`, `inputImage` is required. When `mode = 'text'`, `inputImage` must be absent.

**Response (202)**

```jsonc
{ "generationId": "uuid" }
```

Plugin then opens SSE on `/api/generations/:id/events`.

### `GET /api/generations/:id` (existing — see `generations-history.md`)

When `type='image'` and `status='done'`, the detail view returns `output.variants` array. Each variant entry is augmented at read time with a signed URL:

```jsonc
{
  "index": 0,
  "signedUrl": "https://generated-images.s3.amazonaws.com/...?X-Amz-...",
  "expiresAt": "2026-05-02T11:42:11Z",
  "width": 1024,
  "height": 1024
}
```

For image-mode generations, the input image is also exposed via a signed URL on the detail response so the dashboard can show source + outputs side by side:

```jsonc
{
  "input": {
    /* original input fields */,
    "inputImageSignedUrl": "https://...",
    "inputImageExpiresAt": "..."
  }
}
```

### `GET /api/generations/:id/variants/:index/url`

Refresh a single variant's signed URL.

### `GET /api/generations/:id/input-image/url`

Refresh the input image signed URL (image-mode generations only). 404 for text-mode generations.

### `GET /api/generations/:id/events` (existing pattern)

```
event: image.ready
data: { "generationId": "uuid", "variants": [
  { "index": 0, "signedUrl": "...", "expiresAt": "..." },
  { "index": 1, "signedUrl": "...", "expiresAt": "..." },
  { "index": 2, "signedUrl": "...", "expiresAt": "..." }
]}

event: image.failed
data: { "generationId": "uuid", "error": "string" }
```

### Errors

| Status | Reason |
|--------|--------|
| `400` | Validation (missing fields, `variantCount` ≠ 3, `mode='image'` without `inputImage` part, etc.) |
| `401` | No / invalid session token |
| `403` | `brandId` not in caller's org |
| `404` | Brand has no `is_current=true` profile |
| `409` | Brand profile is `processing` or `failed` |
| `409` | `PER_NODE_LOCK` — image generation already in flight for this `(figmaFileKey, figmaNodeId)`. Body includes `{ conflictingGenerationId }`. |
| `413` | `inputImage` part larger than the 5MB cap |
| `415` | `inputImage` is not a PNG |
| `422` | `dimensions` other than `1024×1024` |
| `502` | Upstream provider error after BullMQ retries |
| `504` | Upstream provider timed out |

## Pipeline

```mermaid
sequenceDiagram
    participant P as Figma plugin
    participant H as API (Hono)
    participant D as Postgres
    participant S as S3
    participant Q as BullMQ
    participant W as Worker
    participant O as OpenAI (gpt-image-2)

    P->>P: (image mode) node.exportAsync({format:'PNG'}) → bytes
    P->>H: POST /api/generations/images (multipart: meta + inputImage?)
    H->>H: validate; resolve brand profile
    alt mode = image
      H->>S: putObject generation-inputs/<orgId>/<genId>/source.png
    end
    H->>D: INSERT generation (type=image, status=pending, mode, file_key, node_id, input_image_s3_key?)
    Note over D: partial unique index enforces per-node lock
    D-->>H: ok (or 409 PER_NODE_LOCK)
    H->>Q: enqueue image-generate { generationId }
    H-->>P: 202 { generationId }
    P->>H: open SSE /api/generations/:id/events

    Q->>W: dispatch
    W->>D: SELECT generation + brand_profile
    W->>W: assemble prompt (user prompt + brand visual block)
    alt mode = image
      W->>S: getObject input.png bytes
      W->>O: images.edit({ model: "gpt-image-2", prompt, image: bytes, n: 3, size: "1024x1024" })
    else mode = text
      W->>O: images.generate({ model: "gpt-image-2", prompt, n: 3, size: "1024x1024" })
    end
    O-->>W: 3 images (base64 bytes inline)
    loop per variant
      W->>S: putObject generations/<orgId>/<genId>/<index>.png
    end
    W->>D: UPDATE generation SET status=done, output=<variants>
    W->>D: INSERT usage_event (provider=openai, model=gpt-image-2, latency, cost)
    W-->>P: SSE image.ready { variants with signedUrls }

    P->>P: show 3 thumbnails, user picks variant
    P->>P: postMessage main-thread { selectedUrl }
    P->>P: figma.createImageAsync(selectedUrl) → fills[] = [{ type:'IMAGE', imageHash, scaleMode:'FILL' }]
```

## Prompt assembly

Brand visual block, rendered from `brand_profile.profile.visual`:

```
Style: <imagery_style.mood joined with ", ">.
Composition: <imagery_style.composition>.
Lighting: <imagery_style.lighting>.
Color treatment: <imagery_style.color_treatment>. Dominant brand colors:
  <primary[].name (#hex), …>; accents: <accent[].name (#hex), …>.
Subjects: <imagery_style.subjects joined with ", ">.
Avoid: <imagery_style.avoid joined with ", ">.
```

### Text-mode final prompt

```
<user prompt>.
<brand visual block>.
1024x1024 PNG. Photographic, on-brand placeholder.
```

### Image-mode final prompt

```
Reimagine the input image with the following changes: <user prompt>.
Maintain the input's general subject and composition unless otherwise instructed.
<brand visual block>.
1024x1024 PNG. Photographic, on-brand placeholder.
```

Image-to-image uses OpenAI's `images.edit` endpoint. We don't expose a `strength` knob in MVP — `gpt-image-2`'s default behavior balances input fidelity against prompt-driven changes well enough. Revisit if results need more control.

The text/voice section of `brand_profile` is **not** injected into image prompts.

If `brand_profile.profile.visual` is missing or sparse, the brand visual block shortens or omits; the user's prompt carries the full weight.

## Worker / job

BullMQ job name: `image-generate`. Configuration:

- `attempts`: 3
- `backoff`: exponential, base 1000ms (attempts at 0s, 1s, 2s)
- On permanent failure: `generation.status=failed`, write `error`, emit `image.failed` SSE.
- One `usage_event` per provider call, even on failed attempts.
- For image-mode, the worker fetches the input bytes from S3 via standard `GetObject` and passes them directly to OpenAI's `images.edit` endpoint via the AI SDK. No third-party signed-URL handoff.

No cross-provider fallback in MVP.

## Per-node lock

Two-layer enforcement, unchanged by adding image-to-image:

1. **Application** — pre-insert check on `WHERE org_id=? AND figma_file_key=? AND figma_node_id=? AND type='image' AND status IN ('pending','running')`. If found, return `409 PER_NODE_LOCK` with the in-flight `generationId`.
2. **Database** — partial unique index. Race-safe: insert fails on the unique constraint and the API converts it to the same `409`.

Plugin behaviour on `409 PER_NODE_LOCK`: subscribe to the conflicting generation's SSE.

The lock applies regardless of `mode`. A user cannot start a text-mode generation on a node that already has an image-mode generation in flight.

## Storage

- **Bucket**: single bucket per environment, e.g. `superside-images-prod`.
- **Key shapes**:
  - Input images: `generation-inputs/<orgId>/<generationId>/source.png`
  - Generated outputs: `generations/<orgId>/<generationId>/<variantIndex>.png`
- **Retention**: forever for both inputs and outputs.
- **Access**: pre-signed GET URLs (1h TTL for client-facing reads). Server-to-OpenAI byte handoff is direct (no signed URL needed). Plugin manifest whitelists the bucket domain.
- **Why upload input via the API rather than direct-to-S3 with a signed PUT URL**: simpler client flow, single round trip, server enforces validation (size cap, content type) before bytes go to disk. Worth revisiting if input sizes climb.

## Latency

Image generation does not need to fit the synchronous text budget (≤2s p50). Async path with SSE notification is sufficient.

| Phase | Budget |
|-------|--------|
| API enqueue + 202 (text mode) | ~50ms |
| API enqueue + 202 (image mode, incl. S3 upload of input) | ~300–800ms |
| BullMQ dispatch | <100ms |
| `gpt-image-2` generate (3 images, single call) | 2–4s p50 |
| Image bytes returned inline by OpenAI | included above |
| S3 upload of 3 outputs | 100–500ms × 3 |
| DB update + SSE | <100ms |
| **Total p50 (text mode)** | **~3–6s end-to-end** |
| **Total p50 (image mode)** | **~4–8s end-to-end** |

p95 closer to 10s. Plugin shows a progress indicator while SSE is open.

## Decisions locked

| Decision | Resolution |
|----------|------------|
| Modes | Text-to-image and image-to-image. Both return 3 variants. |
| Variant count | 3 per request. Locked. |
| Single API call vs N parallel | Single OpenAI `images.generate` (or `images.edit`) call returning 3 images via `n=3`. |
| Designer prompt | Required free-text in both modes. |
| Image upload mechanism | Multipart on the same `POST /api/generations/images` endpoint. No separate upload endpoint in MVP. |
| Input image format | PNG only. ≤ 5MB. |
| Image-to-image control | OpenAI `images.edit` default behavior. No `strength` parameter exposed; not user-configurable in MVP. |
| Frame target metadata | Node id only. No dimension hint from plugin. |
| Provider fallback | None. Single provider (OpenAI `gpt-image-2`). |
| Storage retention | Forever, for both inputs and outputs. |
| Content moderation | Trust the provider. Refusals surface as `failed`. |
| Concurrency / abuse | Per-node lock via partial unique index. One in-flight image gen per `(file, node)`, regardless of mode. |
| Plugin reconnect UX | Plugin reads from `GET /api/generations`. Designed in plugin pass. |
| Dimensions | API accepts `dimensions` for future flexibility; rejects anything other than `1024×1024` with `422`. |
| Auth | Bearer token (`Authorization` header). |

## Out of scope

- Provider fallback to alternative image providers (Claude / fal.ai)
- Aspect ratios other than 1024×1024
- Hard spend caps / per-user concurrency limits beyond the per-node lock
- Server-side content moderation
- Plugin "recent generations" panel UX
- User-controlled fidelity / strength controls for image-mode
- Direct-to-S3 signed PUT URL upload pattern (acceptable upgrade later)
- CDN in front of S3 (acceptable enhancement; not required for MVP)
- Cross-tenant image deduplication or caching
