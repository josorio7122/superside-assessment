import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "../../lib/api";
import { UploadCard } from "./UploadCard";
import { ProfileEditor } from "./ProfileEditor";
import { ReplaceWithPdfCard } from "./ReplaceWithPdfCard";
import { Sidebar } from "./Sidebar";
import { useProfileEvents } from "../../lib/sse";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import "./brand-detail.css";

interface Props {
  brandId: string;
}

export function BrandDetail({ brandId }: Props) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["brand", brandId],
    queryFn: () => api.brands.detail(brandId),
  });
  const versions = useQuery({
    queryKey: ["brand", brandId, "profiles"],
    queryFn: () => api.profiles.listForBrand(brandId),
  });

  const currentProfile = detail.data?.currentProfile ?? null;
  // Latest version row (max version per spec invariants). May or may not be the
  // current row — re-uploads and failed extractions create newer non-current
  // rows that the page must surface.
  const latest = (versions.data ?? []).reduce<typeof versions.data extends infer T ? T extends Array<infer R> ? R | null : null : null>(
    (acc, v) => (acc && acc.version >= v.version ? acc : v),
    null as never,
  );
  const inflight =
    latest && latest.id !== currentProfile?.id && (latest.status === "processing" || latest.status === "failed")
      ? latest
      : null;
  // current = the row whose editor we render. If there's no ready current,
  // fall back to the in-flight row so the page shows a banner instead of the
  // upload card.
  const current = currentProfile ?? inflight;
  // Pending = non-current newer version (re-upload or post-edit retry). Banner
  // sits above the current editor.
  const pending = currentProfile && inflight ? inflight : null;

  // SSE: subscribe to whichever row is in-flight (current or pending).
  const sseTargetId = pending?.id ?? (current?.status === "processing" ? current.id : undefined);
  useProfileEvents(sseTargetId, {
    onReady: () => {
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
    onFailed: () => {
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
  });

  const retry = useMutation({
    mutationFn: (id: string) => api.profiles.retry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
  });

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <p className="text-[var(--color-stone)] text-[0.875rem]">
        Failed to load brand: {(detail.error as Error | undefined)?.message ?? "unknown"}
      </p>
    );
  }

  const brand = detail.data.brand;

  return (
    <>
      <header className="page-head">
        <div>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/brands">Brands</Link>
            <span className="bc-sep">/</span>
            <span>{brand.name}</span>
          </nav>
          <h1>{brand.name}</h1>
          <p className="subtitle">
            {detail.data.stats.genCount30d} generations · 30d
          </p>
        </div>
      </header>

      <div className="bd-layout">
        <div className="bd-main">
          {!current && <UploadCard brandId={brandId} />}

          {pending?.status === "processing" && (
            <div className="processing-banner">
              <h2>Extracting v{pending.version}…</h2>
              <p>
                {pending.sourcePdfFilename
                  ? `Reading ${pending.sourcePdfFilename}.`
                  : "Awaiting source."}{" "}
                This usually takes 30–60s. v{currentProfile?.version} stays current until extraction succeeds.
              </p>
            </div>
          )}

          {pending?.status === "failed" && (
            <div className="failed-banner">
              <h2>v{pending.version} extraction failed</h2>
              <p>{pending.ingestError ?? "Unknown error."}</p>
              <div>
                <Button
                  onClick={() => retry.mutate(pending.id)}
                  disabled={retry.isPending}
                >
                  {retry.isPending ? "Retrying…" : "Retry"}
                </Button>
              </div>
            </div>
          )}

          {!currentProfile && current?.status === "processing" && (
            <div className="processing-banner">
              <h2>Extracting profile…</h2>
              <p>
                {current.sourcePdfFilename
                  ? `Reading ${current.sourcePdfFilename}.`
                  : "Awaiting source."}{" "}
                This usually takes 30–60s. The page will update automatically when ready.
              </p>
            </div>
          )}

          {!currentProfile && current?.status === "failed" && (
            <div className="failed-banner">
              <h2>Extraction failed</h2>
              <p>{current.ingestError ?? "Unknown error."}</p>
              <div>
                <Button
                  onClick={() => retry.mutate(current.id)}
                  disabled={retry.isPending}
                >
                  {retry.isPending ? "Retrying…" : "Retry"}
                </Button>
              </div>
            </div>
          )}

          {current?.status === "ready" && current.profile && (
            <>
              <ProfileEditor profileId={current.id} initial={current.profile} brandId={brandId} />
              <ReplaceWithPdfCard brandId={brandId} />
            </>
          )}
        </div>

        <Sidebar
          brandId={brandId}
          current={current}
          versions={versions.data ?? []}
        />
      </div>
    </>
  );
}
