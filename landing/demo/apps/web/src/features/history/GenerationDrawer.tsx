import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import type { GenerationRow } from "../../lib/api";

interface Props {
  gen: GenerationRow | null;
  brandName: string;
  userName: string;
  onClose: () => void;
}

const TYPE_LABEL: Record<GenerationRow["type"], string> = {
  copy_variant: "Copy variant",
  translate: "Translate",
  image: "Image",
};

function latencyOf(g: GenerationRow): string {
  if (!g.startedAt || !g.completedAt) return "—";
  const ms = new Date(g.completedAt).getTime() - new Date(g.startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function promptOf(g: GenerationRow): string {
  // Best-effort extraction from `input` jsonb shape used by seed
  const input = g.input as {
    type?: string;
    payload?: { prompt?: string; text?: string; from?: string; to?: string; count?: number };
  } | null;
  if (!input?.payload) return "";
  const p = input.payload;
  if (p.prompt) return p.prompt;
  if (p.text) return p.text;
  if (p.from && p.to) return `${p.from} → ${p.to}`;
  return "";
}

function outputOf(g: GenerationRow): string {
  if (g.output == null) return "(no output)";
  if (typeof g.output === "string") return g.output;
  if (Array.isArray(g.output))
    return g.output.map((v) => (typeof v === "string" ? `• ${v}` : JSON.stringify(v))).join("\n");
  return JSON.stringify(g.output, null, 2);
}

export function GenerationDrawer({ gen, brandName, userName, onClose }: Props) {
  return (
    <Sheet open={!!gen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right">
        {gen && (
          <>
            <SheetHeader
              style={{
                padding: "1rem 1.25rem 0.75rem",
                borderBottom: "1px solid var(--color-hairline)",
              }}
            >
              <p className="lbl mono" style={{ marginBottom: "0.35rem" }}>
                generation · {gen.id.slice(0, 8)}
              </p>
              <SheetTitle>{TYPE_LABEL[gen.type]}</SheetTitle>
              <SheetDescription>
                {brandName} · {userName}
              </SheetDescription>
            </SheetHeader>
            <div className="gen-detail-body">
              {promptOf(gen) && <p className="gen-detail-prompt">"{promptOf(gen)}"</p>}
              <div>
                <p className="lbl mono" style={{ marginBottom: "0.4rem" }}>
                  output
                </p>
                <pre className="gen-detail-output">{outputOf(gen)}</pre>
              </div>
              {gen.error && (
                <div>
                  <p className="lbl mono" style={{ marginBottom: "0.4rem" }}>
                    error
                  </p>
                  <pre className="gen-detail-output" style={{ color: "oklch(45% 0.16 25)" }}>
                    {gen.error}
                  </pre>
                </div>
              )}
              <dl className="gen-detail-meta">
                <div>
                  <dt>Status</dt>
                  <dd>{gen.status}</dd>
                </div>
                <div>
                  <dt>Latency</dt>
                  <dd>{latencyOf(gen)}</dd>
                </div>
                {gen.figmaFileKey && (
                  <div>
                    <dt>Figma file</dt>
                    <dd>{gen.figmaFileKey}</dd>
                  </div>
                )}
                {gen.figmaNodeId && (
                  <div>
                    <dt>Node</dt>
                    <dd>{gen.figmaNodeId}</dd>
                  </div>
                )}
                <div>
                  <dt>Started</dt>
                  <dd>{gen.startedAt ? new Date(gen.startedAt).toLocaleTimeString() : "—"}</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd>{gen.completedAt ? new Date(gen.completedAt).toLocaleTimeString() : "—"}</dd>
                </div>
              </dl>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
