import { createFileRoute } from "@tanstack/react-router";
import "../features/plugin/plugin.css";

export const Route = createFileRoute("/plugin")({
  component: PluginPage,
});

const PALETTE = ["#4A154B", "#ECB22E", "#36C5F0", "#2EB67D", "#E01E5A"];

function PluginPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">plugin</p>
          <h1>Figma plugin</h1>
          <p className="subtitle">designer surface · out of demo scope</p>
        </div>
      </header>

      <p className="plugin-caption">
        Brand-aware copy, translation and image generation, embedded inside Figma. The platform writes
        plugin-originating rows to <span className="mono">generation</span> and{" "}
        <span className="mono">usage_event</span> — visible in History and Usage. The runtime itself is
        not part of this demo.
      </p>

      <div className="plugin-stage" role="img" aria-label="Studio Figma plugin mockup">
        <div className="plugin-canvas" aria-hidden="true">
          <div className="canvas-grid"></div>
          <span className="canvas-label mono">slack-q2-ad.fig · page 1 · 100%</span>

          <article className="ad ad-square">
            <div className="ad-frame-label mono">hero-image · 1080 × 1080</div>
            <div className="ad-image"></div>
            <div className="ad-band">
              <p className="ad-eyebrow mono">slack · q2 · en-US</p>
              <h4 className="ad-headline">Where work happens.</h4>
              <span className="ad-cta">
                <span>Try Slack</span>
              </span>
            </div>
          </article>
        </div>

        <div className="plugin-panel">
          <header className="panel-head">
            <div className="panel-mark">
              <span className="ws-mark" aria-hidden="true"></span>
              <span className="panel-title">Studio</span>
            </div>
            <button type="button" className="brand-pill" aria-label="Switch brand">
              <span className="brand-dot" style={{ background: "#4A154B" }}></span>
              Slack
            </button>
          </header>

          <nav className="panel-tabs" aria-label="Plugin actions">
            <button type="button">Copy</button>
            <button type="button">Translate</button>
            <button type="button" data-active="">
              Image
            </button>
          </nav>

          <div className="panel-body">
            <section className="layer-card">
              <div className="layer-thumb" aria-hidden="true"></div>
              <div className="layer-meta">
                <p className="layer-name">hero-image</p>
                <p className="layer-sub mono">frame · 1024 × 1024</p>
              </div>
              <span className="layer-tag mono">selected</span>
            </section>

            <section className="prompt-field">
              <span className="field-label mono">Prompt</span>
              <div className="prompt-box">
                <p>modern team collaboration, sunlit office</p>
                <div className="prompt-foot">
                  <span className="mono">35 / 200</span>
                  <button type="button" className="prompt-cta">
                    Regenerate
                  </button>
                </div>
              </div>
            </section>

            <section className="brand-context">
              <span className="field-label mono">grounded in</span>
              <div className="ctx-row">
                <span className="ctx-pill mono">slack-brand-v3.pdf</span>
                <span className="ctx-pill mono">visual · palette</span>
                <div className="palette-row" aria-hidden="true">
                  {PALETTE.map((c) => (
                    <span key={c} className="ps" style={{ background: c }}></span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <footer className="panel-foot">
            <span className="user-line">
              <span className="user-dot">J</span>
              <span className="mono">jo · DesignTechCo</span>
            </span>
            <span className="conn mono">
              <span className="conn-dot"></span>
              connected
            </span>
          </footer>
        </div>
      </div>

      <p className="plugin-footnote">
        Designer surface — Figma plugin (out of demo scope).
      </p>
    </>
  );
}
