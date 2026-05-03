import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ProfileRow } from "../../lib/api";

interface Props {
  brandId: string;
  versions: ProfileRow[];
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function describe(v: ProfileRow): string {
  if (v.sourcePdfFilename) return `PDF · ${v.sourcePdfFilename}`;
  return "Manual edit";
}

export function VersionTimeline({ brandId, versions }: Props) {
  const qc = useQueryClient();
  const setCurrent = useMutation({
    mutationFn: (id: string) => api.profiles.setCurrent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
  });

  if (versions.length === 0) return null;

  return (
    <div className="version-card">
      <header>
        <span className="card-eyebrow">versions</span>
      </header>
      <ul className="versions">
        {versions.map((v) => (
          <li key={v.id} data-current={v.isCurrent ? "" : undefined}>
            <span className="v-num">v{v.version}</span>
            <div>
              <p>{describe(v)}</p>
              <p className="v-sub">
                {relativeTime(v.createdAt)}
                {v.isCurrent ? " · current" : ""}
              </p>
              {v.status === "processing" && (
                <p className="v-status">processing…</p>
              )}
              {v.status === "failed" && (
                <p className="v-status">failed</p>
              )}
              {!v.isCurrent && v.status === "ready" && (
                <button
                  type="button"
                  className="v-action"
                  disabled={setCurrent.isPending}
                  onClick={() => setCurrent.mutate(v.id)}
                >
                  {setCurrent.isPending ? "setting…" : "Set as current"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
