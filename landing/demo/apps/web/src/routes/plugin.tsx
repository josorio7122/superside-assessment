import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useGenerationEvents, type GenerationVariant } from "../lib/sse";
import "../features/plugin/plugin.css";

export const Route = createFileRoute("/plugin")({
  component: PluginPage,
});

type Status = "idle" | "running" | "done" | "failed";

function PluginPage() {
  const brandsQuery = useQuery({
    queryKey: ["brands"],
    queryFn: () => api.brands.list(),
  });
  const [brandId, setBrandId] = useState<string | null>(null);
  const profileQuery = useQuery({
    queryKey: ["brand", brandId],
    queryFn: () => api.brands.detail(brandId!),
    enabled: !!brandId,
  });

  useEffect(() => {
    if (!brandsQuery.data || brandId) return;
    const ready = brandsQuery.data.find((b) => b.profileStatus === "ready");
    setBrandId((ready ?? brandsQuery.data[0])?.id ?? null);
  }, [brandsQuery.data, brandId]);

  const [prompt, setPrompt] = useState("modern team collaboration, sunlit office");
  const [genId, setGenId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [variants, setVariants] = useState<GenerationVariant[]>([]);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profileReady = profileQuery.data?.currentProfile?.status === "ready";
  const canGenerate = !!brandId && profileReady && prompt.trim().length > 0;

  const generate = useMutation({
    mutationFn: () =>
      api.generations.createImage({
        brandId: brandId!,
        prompt: prompt.trim(),
        layerName: "hero-image",
      }),
    onMutate: () => {
      setStatus("running");
      setVariants([]);
      setAppliedIndex(null);
      setError(null);
    },
    onSuccess: (res) => setGenId(res.id),
    onError: (e: Error) => {
      setStatus("failed");
      setError(e.message);
    },
  });

  useGenerationEvents(genId ?? undefined, {
    onVariantReady: (v) =>
      setVariants((prev) => {
        if (prev.some((p) => p.index === v.index)) return prev;
        return [...prev, v].sort((a, b) => a.index - b.index);
      }),
    onDone: () => setStatus("done"),
    onFailed: (msg) => {
      setStatus("failed");
      setError(msg);
    },
  });

  const heroSrc = appliedIndex !== null && variants[appliedIndex]
    ? `/api/_storage/${encodeURIComponent(variants[appliedIndex].s3Key)}`
    : null;

  const palette = useMemo(
    () => profileQuery.data?.currentProfile?.profile?.visual.palette.slice(0, 5) ?? [],
    [profileQuery.data],
  );
  const sourceLabel =
    profileQuery.data?.currentProfile?.sourcePdfFilename ?? "hand-authored";
  const dotColor = palette[0]?.hex ?? "#E8714F";
  const emptyBg = palette[0]
    ? `linear-gradient(135deg, ${palette[0].hex}, ${palette[1]?.hex ?? palette[0].hex})`
    : undefined;
  const emptyStyle = !heroSrc && emptyBg ? { background: emptyBg } : undefined;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">plugin</p>
          <h1>Figma plugin</h1>
          <p className="subtitle">designer surface · live demo</p>
        </div>
      </header>

      <p className="plugin-caption">
        Brand-aware image generation via <span className="mono">gpt-image-2</span>. Generations
        persist to <span className="mono">generation</span> and <span className="mono">usage_event</span>{" "}
        — visible in History and Usage.
      </p>

      <section className="plugin-stage" aria-label="Studio Figma plugin">
        <div className="plugin-canvas" aria-hidden="true">
          <div className="canvas-grid"></div>
          <span className="canvas-label mono">slack-q2-ad.fig · page 1 · 100%</span>

          <article className="ad ad-square">
            <div className="ad-frame-label mono">hero-image · 1024 × 1024</div>
            <div className="ad-image" style={emptyStyle}>
              {heroSrc && <img src={heroSrc} alt="" />}
            </div>
          </article>
        </div>

        <div className="plugin-panel">
          <header className="panel-head">
            <div className="panel-mark">
              <span className="ws-mark" aria-hidden="true"></span>
              <span className="panel-title">Studio</span>
            </div>
            <BrandPill
              brands={brandsQuery.data ?? []}
              selectedId={brandId}
              dotColor={dotColor}
              onChange={(id) => {
                setBrandId(id);
                setVariants([]);
                setAppliedIndex(null);
                setStatus("idle");
                setGenId(null);
                setError(null);
              }}
            />
          </header>

          <nav className="panel-tabs" aria-label="Plugin actions">
            <button type="button">Copy</button>
            <button type="button">Translate</button>
            <button type="button" data-active="">Image</button>
          </nav>

          <div className="panel-body">
            <section className="layer-card">
              <div className="layer-thumb" aria-hidden="true" style={emptyStyle}>
                {heroSrc && <img src={heroSrc} alt="" />}
              </div>
              <div className="layer-meta">
                <p className="layer-name">hero-image</p>
                <p className="layer-sub mono">frame · 1024 × 1024</p>
              </div>
              <span className="layer-tag mono">selected</span>
            </section>

            {error && (
              <div className="gen-error" role="alert">
                {error} ·{" "}
                <button type="button" className="prompt-cta" onClick={() => generate.mutate()}>
                  Try again
                </button>
              </div>
            )}

            <section className="prompt-field">
              <label className="field-label mono" htmlFor="prompt-textarea">
                Prompt
              </label>
              <div className="prompt-box">
                <textarea
                  id="prompt-textarea"
                  value={prompt}
                  maxLength={200}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                />
                <div className="prompt-foot">
                  <span className="mono">{prompt.length} / 200</span>
                  <button
                    type="button"
                    className="prompt-cta"
                    onClick={() => generate.mutate()}
                    disabled={!canGenerate || status === "running"}
                  >
                    {status === "running" ? "Generating…" : "Regenerate"}
                  </button>
                </div>
              </div>
              {!profileReady && brandId && (
                <p className="prompt-hint mono">brand profile not ready</p>
              )}
            </section>

            {status !== "idle" && (
              <section className="variants-section">
                <div className="variants-head">
                  <span className="field-label mono">3 variants · gpt-image-2</span>
                </div>
                <div className="variants-grid">
                  {[0, 1, 2].map((i) => {
                    const v = variants.find((x) => x.index === i);
                    return (
                      <button
                        key={i}
                        type="button"
                        className="variant"
                        data-applied={appliedIndex === i ? "" : null}
                        disabled={!v}
                        onClick={() => v && setAppliedIndex(i)}
                      >
                        {v ? (
                          <img
                            className="variant-img"
                            src={`/api/_storage/${encodeURIComponent(v.s3Key)}`}
                            alt={`variant ${i + 1}`}
                          />
                        ) : (
                          <div className="variant-skeleton" aria-label="loading variant" />
                        )}
                        {appliedIndex === i && <span className="variant-badge mono">applied</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="brand-context">
              <span className="field-label mono">grounded in</span>
              <div className="ctx-row">
                <span className="ctx-pill mono">{sourceLabel}</span>
                {palette.length > 0 && (
                  <div className="palette-row" aria-hidden="true">
                    {palette.map((p) => (
                      <span key={p.hex} className="ps" style={{ background: p.hex }}></span>
                    ))}
                  </div>
                )}
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
      </section>

      <p className="plugin-footnote">Designer surface — Figma plugin demo.</p>
    </>
  );
}

function BrandPill(props: {
  brands: { id: string; name: string }[];
  selectedId: string | null;
  dotColor: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = props.brands.find((b) => b.id === props.selectedId);
  return (
    <div className="brand-pill-wrap">
      <button
        type="button"
        className="brand-pill"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="brand-dot" style={{ background: props.dotColor }}></span>
        {selected?.name ?? "Pick brand"}
      </button>
      {open && (
        <ul className="brand-menu" role="listbox">
          {props.brands.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                role="option"
                aria-selected={b.id === props.selectedId}
                onClick={() => {
                  props.onChange(b.id);
                  setOpen(false);
                }}
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
