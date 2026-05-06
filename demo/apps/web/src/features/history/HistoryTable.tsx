import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, type GenerationRow } from "../../lib/api";
import { Filters, type HistoryFilters } from "./Filters";
import { GenerationDrawer } from "./GenerationDrawer";
import "./history.css";

const TYPE_LABEL: Record<GenerationRow["type"], string> = {
  copy_variant: "Copy variant",
  translate: "Translate",
  image: "Image",
};

const STATUS_LABEL: Record<GenerationRow["status"], string> = {
  pending: "Pending",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

function relativeTime(iso: string): string {
  const ms = Math.max(0, Date.now() - new Date(iso).getTime());
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function latencyOf(g: GenerationRow): string {
  if (!g.startedAt || !g.completedAt) return "—";
  const ms = new Date(g.completedAt).getTime() - new Date(g.startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function TypeIcon({ type }: { type: GenerationRow["type"] }) {
  if (type === "image") {
    return (
      <span className="type-icon type-image" aria-hidden="true">
        <svg
          width="11"
          height="11"
          viewBox="0 0 11 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          aria-hidden="true"
        >
          <rect x="1" y="1" width="9" height="9" rx="0.5" />
          <circle cx="3.5" cy="4" r="1" />
          <path d="M1 8 L4 5 L7 7.5 L10 5" />
        </svg>
      </span>
    );
  }
  if (type === "translate") {
    return (
      <span className="type-icon type-translate" aria-hidden="true">
        <svg
          width="11"
          height="11"
          viewBox="0 0 11 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          aria-hidden="true"
        >
          <path d="M1 2 H6" />
          <path d="M3.5 2 V3 c0 1.5 -1.5 3 -2.5 3" />
          <path d="M2 5.5 c1 0 2.5 -1 2.5 -2.5" />
          <path d="M6 9 L8 4.5 L10 9" />
          <path d="M6.7 7.5 H9.3" />
        </svg>
      </span>
    );
  }
  return (
    <span className="type-icon type-copy_variant" aria-hidden="true">
      <svg
        width="11"
        height="11"
        viewBox="0 0 11 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        aria-hidden="true"
      >
        <path d="M2 2.5 H8 M2 5 H8 M2 7.5 H6" />
      </svg>
    </span>
  );
}

export function HistoryTable() {
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [selected, setSelected] = useState<GenerationRow | null>(null);

  const list = useQuery({
    queryKey: ["generations", filters],
    queryFn: () =>
      api.generations.list({
        brandId: filters.brandId,
        type: filters.type,
        status: filters.status,
        userId: filters.userId,
        limit: 100,
      }),
  });

  const brandsQ = useQuery({ queryKey: ["brands"], queryFn: api.brands.list });
  const usersQ = useQuery({ queryKey: ["users"], queryFn: api.users.list });

  const brandById = useMemo(() => {
    const m = new Map<string, string>();
    brandsQ.data?.forEach((b) => {
      m.set(b.id, b.name);
    });
    return m;
  }, [brandsQ.data]);

  const userById = useMemo(() => {
    const m = new Map<string, { name: string }>();
    usersQ.data?.forEach((u) => {
      m.set(u.id, { name: u.name });
    });
    return m;
  }, [usersQ.data]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">generations</p>
          <h1>History</h1>
          <p className="subtitle">{list.data ? `${list.data.items.length} loaded` : "loading"} · last 30 days</p>
        </div>
      </header>

      <Filters value={filters} onChange={setFilters} />

      {list.isLoading && <p className="text-[var(--color-stone)] text-[0.875rem]">Loading…</p>}

      {list.isError && (
        <p className="text-[var(--color-stone)] text-[0.875rem]">Failed to load: {(list.error as Error).message}</p>
      )}

      {list.data && list.data.items.length === 0 && (
        <div className="hist-empty">No generations match these filters.</div>
      )}

      {list.data && list.data.items.length > 0 && (
        <table className="hist-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Brand</th>
              <th>User</th>
              <th className="num">Latency</th>
              <th>When</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.data.items.map((g) => {
              const isSel = selected?.id === g.id;
              const u = userById.get(g.userId);
              return (
                <tr key={g.id} data-selected={isSel ? "" : undefined} onClick={() => setSelected(g)}>
                  <td>
                    <span className="type-cell">
                      <TypeIcon type={g.type} />
                      {TYPE_LABEL[g.type]}
                    </span>
                  </td>
                  <td>{brandById.get(g.brandId) ?? "—"}</td>
                  <td>
                    <span className="user-cell">
                      <span className="hist-avatar">{(u?.name ?? "?").charAt(0)}</span>
                      {u?.name ?? "—"}
                    </span>
                  </td>
                  <td className="num mono small">{latencyOf(g)}</td>
                  <td className="mono small subtle">{relativeTime(g.createdAt)}</td>
                  <td>
                    <span className={`pill pill-${g.status}`}>{STATUS_LABEL[g.status]}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <GenerationDrawer
        gen={selected}
        brandName={selected ? (brandById.get(selected.brandId) ?? "") : ""}
        userName={selected ? (userById.get(selected.userId)?.name ?? "") : ""}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
