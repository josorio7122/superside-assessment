import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import type { BrandProfile } from "@studio/schemas";
import { api } from "../../lib/api";

interface Props {
  profileId: string;
  initial: BrandProfile;
  brandId: string;
}

export function ProfileEditor({ profileId, initial, brandId }: Props) {
  const [draft, setDraft] = useState<BrandProfile>(initial);
  const qc = useQueryClient();

  // Reset local draft when the upstream profile changes (new version created,
  // SSE invalidated cache, "Set as current" flipped, etc.)
  useEffect(() => {
    setDraft(initial);
  }, [initial, profileId]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const save = useMutation({
    mutationFn: () => api.profiles.edit(profileId, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
  });

  return (
    <>
      <div className="bd-head-actions" style={{ marginBottom: "1rem", justifyContent: "flex-end", display: "flex" }}>
        <Button
          variant="outline"
          onClick={() => setDraft(initial)}
          disabled={!dirty || save.isPending}
        >
          Discard
        </Button>
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      {save.isError && (
        <p className="text-[0.8125rem]" style={{ color: "oklch(45% 0.16 25)", marginBottom: "0.75rem" }}>
          Save failed: {(save.error as Error).message}
        </p>
      )}

      <Tabs defaultValue="voice">
        <TabsList className="bd-tabs">
          <TabsTrigger className="bd-tab-trigger" value="voice">
            Voice
          </TabsTrigger>
          <TabsTrigger className="bd-tab-trigger" value="visual">
            Visual
          </TabsTrigger>
          <TabsTrigger className="bd-tab-trigger" value="localization">
            Localization
          </TabsTrigger>
          <TabsTrigger className="bd-tab-trigger" value="banned">
            Banned
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voice">
          <ToneChipsField
            value={draft.voice.tone_descriptors}
            onChange={(v) =>
              setDraft({
                ...draft,
                voice: { ...draft.voice, tone_descriptors: v.slice(0, 8) },
              })
            }
          />
          <PrinciplesField
            value={draft.voice.voice_principles}
            onChange={(v) =>
              setDraft({
                ...draft,
                voice: { ...draft.voice, voice_principles: v },
              })
            }
          />
          <DoDontField
            doList={draft.voice.do}
            dontList={draft.voice.dont}
          />
        </TabsContent>

        <TabsContent value="visual">
          <section className="field">
            <div className="lbl-row">
              <span className="lbl">Palette</span>
              <span className="lbl-meta">{draft.visual.palette.length} colors</span>
            </div>
            <ul className="swatches" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" }}>
              {draft.visual.palette.map((c) => (
                <li key={`${c.name}-${c.hex}`} style={{ border: "1px solid var(--color-hairline)", padding: "0.55rem 0.65rem", borderRadius: "4px", background: "oklch(98% 0.003 60)" }}>
                  <span className="sw" style={{ background: c.hex }}></span>
                  <div>
                    <p>{c.name}</p>
                    <p className="mono">{c.hex.toUpperCase()}</p>
                  </div>
                </li>
              ))}
              {draft.visual.palette.length === 0 && (
                <li style={{ color: "var(--color-stone)", fontSize: "0.8125rem" }}>
                  No palette extracted from source.
                </li>
              )}
            </ul>
          </section>
          {draft.visual.typography &&
            (draft.visual.typography.display || draft.visual.typography.body || draft.visual.typography.mono) && (
              <section className="field">
                <div className="lbl-row">
                  <span className="lbl">Typography</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {(["display", "body", "mono"] as const).map((kind) => {
                    const v = draft.visual.typography?.[kind];
                    if (!v) return null;
                    return (
                      <li key={kind} style={{ fontSize: "0.8125rem" }}>
                        <span className="mono" style={{ color: "var(--color-stone)", marginRight: "0.5rem" }}>
                          {kind}
                        </span>
                        {v}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
        </TabsContent>

        <TabsContent value="localization">
          <section className="field">
            <div className="lbl-row">
              <span className="lbl">Locales</span>
              <span className="lbl-meta">{draft.localization.locales.length}</span>
            </div>
            {draft.localization.locales.length > 0 ? (
              <div className="locale-list">
                {draft.localization.locales.map((l) => (
                  <span key={l} className="locale-pill">
                    {l}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--color-stone)", fontSize: "0.8125rem", margin: 0 }}>
                No locales listed in source.
              </p>
            )}
            {draft.localization.notes && (
              <p
                style={{
                  marginTop: "0.85rem",
                  fontSize: "0.8125rem",
                  color: "var(--color-reading)",
                  lineHeight: 1.55,
                }}
              >
                {draft.localization.notes}
              </p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="banned">
          <BannedTermsField
            value={draft.banned_terms}
            onChange={(v) => setDraft({ ...draft, banned_terms: v })}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ============================================================================
// Voice tab fields
// ============================================================================

function ToneChipsField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [adding, setAdding] = useState("");
  const remaining = 8 - value.length;
  return (
    <section className="field">
      <div className="lbl-row">
        <span className="lbl">Tone descriptors</span>
        <span className="lbl-meta">{value.length} / 8</span>
      </div>
      <div className="chips">
        {value.map((v, i) => (
          <span key={`${v}-${i}`} className="chip">
            {v}
            <button
              type="button"
              className="chip-x"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
        {remaining > 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = adding.trim();
              if (t && !value.includes(t)) {
                onChange([...value, t]);
                setAdding("");
              }
            }}
          >
            <input
              className="chip-input"
              placeholder="+ add"
              aria-label="Add tone descriptor"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
            />
          </form>
        )}
      </div>
    </section>
  );
}

function PrinciplesField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <section className="field">
      <div className="lbl-row">
        <span className="lbl">Voice principles</span>
        <span className="lbl-meta">extracted, edited</span>
      </div>
      {value.map((v, i) => (
        <div key={i} className="principle-row">
          <textarea
            className="principle-input"
            aria-label={`Voice principle ${i + 1}`}
            value={v}
            rows={2}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? e.target.value : x)))
            }
          />
          <button
            type="button"
            className="principle-remove"
            aria-label="Remove principle"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="principle-add"
        onClick={() => onChange([...value, ""])}
      >
        + Add principle
      </button>
    </section>
  );
}

function DoDontField({ doList, dontList }: { doList: string[]; dontList: string[] }) {
  if (doList.length === 0 && dontList.length === 0) return null;
  return (
    <section className="field">
      <div className="lbl-row">
        <span className="lbl">Do · Don't</span>
        <span className="lbl-meta">read-only</span>
      </div>
      <div className="do-dont">
        <div>
          <p className="lbl" style={{ marginBottom: "0.4rem" }}>
            do
          </p>
          <ul className="do-list">
            {doList.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="lbl" style={{ marginBottom: "0.4rem" }}>
            don't
          </p>
          <ul className="dont-list">
            {dontList.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Banned tab
// ============================================================================

function BannedTermsField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [adding, setAdding] = useState("");
  return (
    <section className="field">
      <div className="lbl-row">
        <span className="lbl">Banned terms</span>
        <span className="lbl-meta">{value.length}</span>
      </div>
      <div className="banned-grid">
        {value.map((v, i) => (
          <span key={`${v}-${i}`} className="banned-chip">
            {v}
            <button
              type="button"
              className="banned-chip-x"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = adding.trim();
          if (t && !value.includes(t)) {
            onChange([...value, t]);
            setAdding("");
          }
        }}
        style={{ marginTop: "0.5rem" }}
      >
        <input
          className="chip-input"
          placeholder="+ add banned term"
          aria-label="Add banned term"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
        />
      </form>
    </section>
  );
}
