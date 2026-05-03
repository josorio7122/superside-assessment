import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api, type BrandWithStats } from "../../lib/api";
import { NewBrandDialog } from "./NewBrandDialog";
import { RenameBrandDialog } from "./RenameBrandDialog";
import { DeleteBrandDialog } from "./DeleteBrandDialog";
import { Skeleton } from "../../components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
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
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!query) return list;
    const needle = query.toLowerCase();
    return list.filter((b) => b.name.toLowerCase().includes(needle));
  }, [q.data, query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          <div className="search">
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <circle cx="4.5" cy="4.5" r="3" />
              <path d="M7 7 L9.5 9.5" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search brands"
              aria-label="Search brands"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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

      {q.data && q.data.length > 0 && filtered.length === 0 && (
        <div className="border border-[var(--color-hairline)] rounded p-6 text-center">
          <p className="text-[var(--color-charcoal)] text-[0.9375rem]">
            No brands match “{query}”.
          </p>
        </div>
      )}

      {q.data && filtered.length > 0 && (
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
            {filtered.map((b, i) => {
              const status = statusOf(b);
              const hue = HUES[i % HUES.length];
              const glyph = b.name.charAt(0).toUpperCase();
              return (
                <tr
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${b.name}`}
                  onClick={() => navigate({ to: "/brands/$brandId", params: { brandId: b.id } })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate({ to: "/brands/$brandId", params: { brandId: b.id } });
                    }
                  }}
                >
                  <td>
                    <span className="brand-link">
                      <span
                        className="brand-glyph"
                        style={{ background: `oklch(85% 0.06 ${hue})` }}
                      >
                        {glyph}
                      </span>
                      <span className="brand-name">{b.name}</span>
                    </span>
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
                  <td className="row-action" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="row-menu-btn"
                          aria-label={`Actions for ${b.name}`}
                        >
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
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setRenameTarget({ id: b.id, name: b.name })}
                        >
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="row-menu-danger"
                          onSelect={() => setDeleteTarget({ id: b.id, name: b.name })}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {renameTarget && (
        <RenameBrandDialog
          brandId={renameTarget.id}
          currentName={renameTarget.name}
          open
          onOpenChange={(o) => !o && setRenameTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteBrandDialog
          brandId={deleteTarget.id}
          brandName={deleteTarget.name}
          open
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        />
      )}
    </>
  );
}
