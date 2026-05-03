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
  // When a brand has no current profile yet (fresh brand mid-extraction, or
  // every prior attempt failed), surface the latest in-flight or failed row so
  // the user sees a banner instead of the upload card disappearing without
  // explanation.
  const inflight = currentProfile
    ? null
    : (versions.data ?? []).find((v) => v.status === "processing" || v.status === "failed") ?? null;
  const current = currentProfile ?? inflight;

  useProfileEvents(current?.status === "processing" ? current.id : undefined, {
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
    mutationFn: () => api.profiles.retry(current!.id),
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

          {current?.status === "processing" && (
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

          {current?.status === "failed" && (
            <div className="failed-banner">
              <h2>Extraction failed</h2>
              <p>{current.ingestError ?? "Unknown error."}</p>
              <div>
                <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
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
