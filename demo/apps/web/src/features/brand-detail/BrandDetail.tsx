import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { api, type ProfileRow } from "../../lib/api";
import { useProfileEvents } from "../../lib/sse";
import { ProfileEditor } from "./ProfileEditor";
import { ReplaceWithPdfCard } from "./ReplaceWithPdfCard";
import { Sidebar } from "./Sidebar";
import { UploadCard } from "./UploadCard";
import "./brand-detail.css";

interface Props {
  brandId: string;
}

interface BannerProps {
  pending: ProfileRow | null;
  current: ProfileRow | null;
  hasCurrent: boolean;
  currentVersion: number | undefined;
  retryId: (id: string) => void;
  retrying: boolean;
}

function ExtractionBanners({ pending, current, hasCurrent, currentVersion, retryId, retrying }: BannerProps) {
  return (
    <>
      {pending?.status === "processing" && (
        <div className="processing-banner">
          <h2>Extracting v{pending.version}…</h2>
          <p>
            {pending.sourcePdfFilename ? `Reading ${pending.sourcePdfFilename}.` : "Awaiting source."} This usually
            takes 30–60s. v{currentVersion} stays current until extraction succeeds.
          </p>
        </div>
      )}
      {pending?.status === "failed" && (
        <div className="failed-banner">
          <h2>v{pending.version} extraction failed</h2>
          <p>{pending.ingestError ?? "Unknown error."}</p>
          <div>
            <Button onClick={() => retryId(pending.id)} disabled={retrying}>
              {retrying ? "Retrying…" : "Retry"}
            </Button>
          </div>
        </div>
      )}
      {!hasCurrent && current?.status === "processing" && (
        <div className="processing-banner">
          <h2>Extracting profile…</h2>
          <p>
            {current.sourcePdfFilename ? `Reading ${current.sourcePdfFilename}.` : "Awaiting source."} This usually
            takes 30–60s. The page will update automatically when ready.
          </p>
        </div>
      )}
      {!hasCurrent && current?.status === "failed" && (
        <div className="failed-banner">
          <h2>Extraction failed</h2>
          <p>{current.ingestError ?? "Unknown error."}</p>
          <div>
            <Button onClick={() => retryId(current.id)} disabled={retrying}>
              {retrying ? "Retrying…" : "Retry"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
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
  const latest = (versions.data ?? []).reduce<
    typeof versions.data extends infer T ? (T extends Array<infer R> ? R | null : null) : null
  >((acc, v) => (acc && acc.version >= v.version ? acc : v), null as never);
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
          <p className="subtitle">{detail.data.stats.genCount30d} generations · 30d</p>
        </div>
      </header>

      <div className="bd-layout">
        <div className="bd-main">
          {!current && <UploadCard brandId={brandId} />}

          <ExtractionBanners
            pending={pending}
            current={current}
            hasCurrent={!!currentProfile}
            currentVersion={currentProfile?.version}
            retryId={(id) => retry.mutate(id)}
            retrying={retry.isPending}
          />

          {current?.status === "ready" && current.profile && (
            <>
              <ProfileEditor profileId={current.id} initial={current.profile} brandId={brandId} />
              <ReplaceWithPdfCard brandId={brandId} />
            </>
          )}
        </div>

        <Sidebar brandId={brandId} current={current} versions={versions.data ?? []} />
      </div>
    </>
  );
}
