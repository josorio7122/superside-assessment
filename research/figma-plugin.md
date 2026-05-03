# Figma Plugin Capabilities — Research Notes

Reference material gathered while designing the platform's API contract. Captures what the Figma plugin runtime allows, what it doesn't, and how those constraints shape our backend design.

Sources: Figma Developer Docs (`developers.figma.com/docs/plugins/...`), confirmed against community examples.

## Plugin runtime model

A Figma plugin runs in **two contexts**:

```
┌──────────────────────────┐    postMessage    ┌──────────────────────────┐
│  Main thread (sandbox)   │ <───────────────> │  UI iframe (full browser)│
│  - figma global          │                   │  - DOM, fetch, EventSource│
│  - read/write nodes      │                   │  - WebSocket, localStorage│
│  - figma.clientStorage   │                   │  - figma.ui.postMessage  │
│  - no DOM, no fetch hist.│                   │                          │
└──────────────────────────┘                   └──────────────────────────┘
```

- **Main thread** has access to the `figma` global (read/write the canvas) but historically lacks `fetch`, `setTimeout`, and DOM. Figma has since added a Fetch API to the main thread, but the iframe pattern is still the recommended path for any non-trivial network/auth work.
- **UI iframe** has full browser APIs but no `figma` global. Created with `figma.showUI(html, options)`.
- The two communicate only via `postMessage`. All work that touches Figma nodes happens on the main thread; all network/UI/auth work happens in the iframe.

## Network requests

### Domain whitelisting via manifest

```json
{
  "name": "MyPlugin",
  "networkAccess": {
    "allowedDomains": [
      "https://api.example.com",
      "wss://api.example.com",
      "https://*.s3.amazonaws.com"
    ],
    "reasoning": "Calls to platform API and image asset fetch.",
    "devAllowedDomains": ["http://localhost:3000"]
  }
}
```

- Anything not whitelisted is blocked at the CSP level.
- Wildcards work for subdomains (`*.example.com`) and paths (`example.com/api/`).
- `wss://` allowed for WebSockets.
- `["*"]` is permitted but requires `reasoning`.
- `["none"]` blocks all network.

### Implication for our platform

- Our API must live at a **single fixed domain** baked into the plugin manifest (e.g. `https://api.designtechco.com`).
- Auth landing page domain (where WorkOS posts the user back) needs whitelisting too.
- Generated-image S3 URLs need either a fixed bucket domain or a CloudFront/CDN distribution we can pin.
- This forecloses on dynamic per-tenant API hostnames — multi-tenant has to be a single API surface where the tenant is resolved from the auth token.

## Authentication

- The plugin sandbox **cannot use cookies** for our API. Cookies belong to the iframe's `null` origin and don't survive in a way that fits our session model.
- The accepted pattern is **OAuth in the UI iframe + token storage via `figma.clientStorage`**:

  1. UI iframe checks `clientStorage` for an existing token via `postMessage` to main thread.
  2. If absent or expired, iframe opens a hosted auth page (`window.open`) on **our** domain.
  3. User signs in via WorkOS → our auth page receives the token.
  4. Auth page returns the token to the iframe (origin-restricted `postMessage` to `https://www.figma.com`).
  5. Iframe forwards the token to the main thread, which calls `figma.clientStorage.setAsync('token', token)`.
  6. All subsequent API calls send `Authorization: Bearer <token>`.

- `figma.clientStorage`:
  - 5MB total, scoped per `(plugin id, user id)`.
  - Async API only (`getAsync`, `setAsync`, `deleteAsync`, `keysAsync`).
  - "Stored privately for stability, not security" — sufficiently isolated from other plugins, but not encrypted.

### Implication for our platform

- Our auth middleware must accept **two session styles**: cookie-based for admin web, bearer-token-based for plugin.
- Bearer tokens need explicit revocation (logout endpoint) and refresh (silent re-auth in iframe before expiry).
- The auth landing page that handles the OAuth callback must be a stable, publicly-hosted page on our domain; the iframe `window.open`s it during sign-in.

## Long-running operations / async patterns

- **The plugin terminates when the user closes it.** No background execution, no service workers, no persistent state outside `clientStorage`.
- Long compute on the main thread freezes the Figma UI (the docs explicitly call this out as a tradeoff).
- The official guidance for long ops on the main thread is to chunk work and yield via `setTimeout(fn, 1)`.
- For network long-polling / async waits, the UI iframe handles it (`fetch`, `EventSource`, `WebSocket`).

### Implication for our platform

- **Image generation** (which can take 5–15s) cannot be a single sync HTTP call from the plugin's perspective without freezing the UI. Use:
  - Async POST returns `{ generationId }`.
  - UI iframe opens an SSE channel on `/api/generations/:id/events`.
  - On completion, iframe gets `imageUrl`, posts to main thread, main thread calls `figma.createImageAsync(imageUrl)` to apply the fill.
- **Copy variants and translation** stay sync — the latency budget (≤2s) fits a single round-trip and the plugin awaits the response.
- The server must not assume the plugin is still listening. If the plugin closes mid-generation, the row in `generation` still resolves in the background; the user picks it back up via the generations history view next time they open the plugin (or admin web).

## Reading and writing text layers

The `TextNode` API exposes everything we need to drive F1 (copy variants) and F2 (translation):

| Property | Type | Use for our API |
|---|---|---|
| `node.id` | string | Stable layer identifier within the file |
| `node.name` | string | Layer name as shown in the Figma sidebar — `"Headline"`, `"CTA"`, etc. → role hint |
| `node.characters` | string | Current text content → seed for copy gen / source for translation |
| `node.fontSize` | number | Combined with width, gives a reasonable character cap |
| `node.width`, `node.height` | number | Bounding box — informs `charLimit` |
| `node.textAutoResize` | `'NONE' \| 'WIDTH_AND_HEIGHT' \| 'HEIGHT' \| 'TRUNCATE'` | If `NONE`, the layer has hard width/height — strict cap |
| `node.fontName` | `{ family, style }` | Pass through if image gen ever needs typography hints |
| `figma.currentPage.selection` | array | What the user has selected — what the plugin sends |

- Writing is symmetric: set `node.characters = "..."` after the API responds.
- Fonts must be loaded before `characters` can be set: `await figma.loadFontAsync(node.fontName)`.

### Implication for our platform

- The plugin computes `charLimit` per layer locally (font size × width gives a serviceable estimate). Backend treats it as a soft prompt constraint, not a server-side validation.
- Layer "role" is sourced from `node.name`. If unnamed, the model treats it as generic copy. We do **not** require the plugin to maintain a registry of templates or layer roles.

## Images and image fills

Figma has no concept of "image layers". Images live as fills inside shape nodes (rectangles or frames). The relevant API:

- `figma.createImageAsync(src: string): Promise<Image>`
  - `src` must be a public URL to a PNG, JPEG, or GIF.
  - Image objects are not nodes; they're handles referenced by `imageHash`.
  - Max 4096×4096.
- `figma.createImage(bytes: Uint8Array): Image`
  - Accepts raw bytes — used when fetching from a non-public URL or wanting to avoid making a public URL at all (UI iframe fetches, posts bytes to main thread).
- Apply the image as a paint:

```ts
node.fills = [{
  type: 'IMAGE',
  imageHash: image.hash,
  scaleMode: 'FILL'
}]
```

### Implication for our platform

- Generated images need to be reachable by the plugin via either:
  - **A public/signed URL** that we whitelist in the manifest (e.g. `*.s3.amazonaws.com` or our CDN), and the plugin calls `createImageAsync(url)`. Simplest.
  - **A bytes payload** returned in the API response or fetched separately, fed into `createImage(bytes)`. More work.
- We're going with signed S3 URLs (time-limited, 1h is plenty). The plugin caches the bytes via `imageHash` after `createImageAsync` runs, so the URL expiring later doesn't break the rendered fill in the file.

## What this means for our backend, summarized

| Backend concern | Constraint from Figma plugin |
|---|---|
| API hostname | Single fixed domain, baked into plugin manifest |
| Auth | Bearer token (Authorization header), not cookies, for plugin requests |
| Token storage | Plugin holds it in `figma.clientStorage`; we issue, rotate, revoke |
| Sync vs async | ≤2s sync round-trip works for text; image must be async (job + SSE) |
| Image return path | Public/signed URL whitelisted in manifest; plugin uses `createImageAsync` |
| Server-side state | Must not assume the plugin is still connected — durable `generation` rows + replayable history |
| CSP / origin handling | Auth callback page must `postMessage` to `https://www.figma.com` only |

## What stays open

These don't block our current API design but will need attention when the plugin design pass happens:

- **Token format** — opaque WorkOS sealed session vs JWT minted by our backend. Both work. WorkOS's sealed session is simpler.
- **Token refresh strategy** — silent re-auth in the iframe before expiry vs reactive 401 → re-auth flow. Likely silent.
- **Rate handling** of generated-image URL expiry — if a designer opens an old `.fig` file with a removed image source, behaviour is determined by Figma (cached `imageHash`); we should test this, not assume.
- **Plugin distribution model** — private plugin within DesignTechCo's workspace for the pilot vs public Community plugin later. Affects manifest `id` and review process, not the API.

## Source references

- [How Plugins Run](https://developers.figma.com/docs/plugins/how-plugins-run/)
- [Plugin Manifest](https://developers.figma.com/docs/plugins/manifest/)
- [Making Network Requests](https://developers.figma.com/docs/plugins/making-network-requests/)
- [OAuth with Plugins](https://developers.figma.com/docs/plugins/oauth-with-plugins/)
- [`figma.clientStorage`](https://developers.figma.com/docs/plugins/api/figma-clientStorage/)
- [Asynchronous Tasks](https://developers.figma.com/docs/plugins/async-tasks/)
- [Frozen Plugins](https://www.figma.com/plugin-docs/frozen-plugins/)
- [`createImageAsync`](https://www.figma.com/plugin-docs/api/properties/figma-createimageasync/)
- [ImagePaint](https://developers.figma.com/docs/widgets/api/type-ImagePaint/)
