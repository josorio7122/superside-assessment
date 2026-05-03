import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api, type BrandWithStats } from "../../lib/api";
import { NewBrandDialog } from "./NewBrandDialog";
import { Skeleton } from "../../components/ui/skeleton";
import "./brands.css";

const HUES = [320, 130, 30, 0, 270, 200, 250, 60, 180];

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function statusOf(b: BrandWithStats): "ready" | "processing" | "failed" | "empty" {
  if (b.profileStatus === "ready") return "ready";
  if (b.profileStatus === "processing") return "processing";
  if (b.profileStatus === "failed") return "failed";
  return "empty";
}

export function BrandsList() {
  const q = useQuery({ queryKey: ["brands"], queryFn: api.brands.list });

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">brands</p>
          <h1>Brands</h1>
          <p className="subtitle">
            {q.data ? `${q.data.length} brand${q.data.length === 1 ? "" : "s"} · pilot tenant` : "loading"}
          </p>
        </div>
        <div className="brands-head-actions">
          <div className="search" aria-hidden="true">
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <circle cx="4.5" cy="4.5" r="3" />
              <path d="M7 7 L9.5 9.5" />
            </svg>
            <input
              type="text"
              placeholder="Search brands"
              aria-label="Search brands"
              tabIndex={-1}
              readOnly
            />
            <span className="kbd mono">⌘K</span>
          </div>
          <NewBrandDialog />
        </div>
      </header>

      {q.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {q.isError && (
        <p className="text-[var(--color-stone)] text-[0.875rem]">
          Failed to load brands: {(q.error as Error).message}
        </p>
      )}

      {q.data && q.data.length === 0 && (
        <div className="border border-[var(--color-hairline)] rounded p-6 text-center">
          <p className="text-[var(--color-charcoal)] text-[0.9375rem]">No brands yet.</p>
          <p className="text-[var(--color-stone)] text-[0.8125rem] mt-1">
            Create one to upload a guideline PDF.
          </p>
        </div>
      )}

      {q.data && q.data.length > 0 && (
        <table className="brands-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Guideline</th>
              <th className="num">Generations · 30d</th>
              <th>Last activity</th>
              <th aria-label="Row action"></th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((b, i) => {
              const status = statusOf(b);
              const hue = HUES[i % HUES.length];
              const glyph = b.name.charAt(0).toUpperCase();
              return (
                <tr key={b.id}>
                  <td>
                    <Link
                      to="/brands/$brandId"
                      params={{ brandId: b.id }}
                      className="brand-link"
                    >
                      <span className="brand-glyph" style={{ background: `oklch(85% 0.06 ${hue})` }}>
                        {glyph}
                      </span>
                      <span className="brand-name">{b.name}</span>
                    </Link>
                  </td>
                  <td>
                    <span className={`status status-${status}`}>
                      <span className="dot"></span>
                      {status === "ready" && "Ready"}
                      {status === "processing" && "Processing"}
                      {status === "failed" && "Failed"}
                      {status === "empty" && "Empty"}
                    </span>
                  </td>
                  <td className="num mono">{b.genCount30d.toLocaleString()}</td>
                  <td className="mono small subtle">{relativeTime(b.lastActivityAt)}</td>
                  <td className="row-action">
                    <svg
                      width="14"
                      height="3"
                      viewBox="0 0 14 3"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <circle cx="2" cy="1.5" r="1" />
                      <circle cx="7" cy="1.5" r="1" />
                      <circle cx="12" cy="1.5" r="1" />
                    </svg>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
