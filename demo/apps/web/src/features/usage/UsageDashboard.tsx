import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../lib/api";
import "./usage.css";

type Range = "7" | "30";

function formatDay(key: string): string {
  // Postgres returns "2026-04-26 00:00:00+00"; the trailing "+00" without ":00"
  // is rejected by Chrome's date parser, so normalize it to "+00:00" first.
  const normalized = key.replace(" ", "T").replace(/\+(\d{2})$/, "+$1:00");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return key.slice(5, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function UsageDashboard() {
  const [range, setRange] = useState<Range>("30");
  const days = Number(range);

  const dayQ = useQuery({
    queryKey: ["usage", "day", days],
    queryFn: () => api.usage.rollup("day", days),
  });
  const userQ = useQuery({
    queryKey: ["usage", "user", days],
    queryFn: () => api.usage.rollup("user", days),
  });
  const usersQ = useQuery({ queryKey: ["users"], queryFn: api.users.list });

  const userById = useMemo(() => {
    const m = new Map<string, { name: string }>();
    usersQ.data?.forEach((u) => {
      m.set(u.id, { name: u.name });
    });
    return m;
  }, [usersQ.data]);

  const chartData = useMemo(() => {
    return (dayQ.data ?? []).map((row) => ({
      day: formatDay(row.key),
      cost: Number(row.costUsd),
      calls: row.calls,
    }));
  }, [dayQ.data]);

  const totals = useMemo(() => {
    const rows = dayQ.data ?? [];
    const total = rows.reduce((s, r) => s + Number(r.costUsd), 0);
    const calls = rows.reduce((s, r) => s + r.calls, 0);
    const totalLatency = rows.reduce((s, r) => s + r.avgLatencyMs * r.calls, 0);
    const avgLatency = calls > 0 ? totalLatency / calls : 0;
    return { total, calls, avgLatency };
  }, [dayQ.data]);

  const userRows = useMemo(() => {
    const rows = (userQ.data ?? []).slice().sort((a, b) => Number(b.costUsd) - Number(a.costUsd));
    const totalCost = rows.reduce((s, r) => s + Number(r.costUsd), 0);
    return rows.map((r) => {
      const cost = Number(r.costUsd);
      const share = totalCost > 0 ? cost / totalCost : 0;
      const u = userById.get(r.key);
      return {
        userId: r.key,
        name: u?.name ?? r.key.slice(0, 6),
        calls: r.calls,
        cost,
        share,
        avgLatencyMs: r.avgLatencyMs,
      };
    });
  }, [userQ.data, userById]);

  const totalUserCost = userRows.reduce((s, r) => s + r.cost, 0);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">usage</p>
          <h1>Usage</h1>
          <p className="subtitle">last {days} days · org-wide</p>
        </div>
        <div className="usage-head-actions">
          <div className="range" role="tablist" aria-label="Date range">
            {(["7", "30"] as Range[]).map((r) => (
              <button
                key={r}
                role="tab"
                type="button"
                data-active={range === r ? "" : undefined}
                onClick={() => setRange(r)}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="usage-layout">
        <section className="summary">
          <div className="stat">
            <span className="stat-eyebrow">Total spend</span>
            <p className="stat-value">
              <span className="stat-currency">$</span>
              <span>{totals.total.toFixed(2)}</span>
            </p>
            <p className="stat-delta">{days} day window</p>
          </div>
          <div className="stat">
            <span className="stat-eyebrow">Generations</span>
            <p className="stat-value">
              <span>{totals.calls.toLocaleString()}</span>
            </p>
            <p className="stat-delta">includes extractions</p>
          </div>
          <div className="stat">
            <span className="stat-eyebrow">Avg latency</span>
            <p className="stat-value">
              <span>{(totals.avgLatency / 1000).toFixed(1)}</span>
              <span className="stat-unit">s</span>
            </p>
            <p className="stat-delta">weighted by call</p>
          </div>
        </section>

        <section className="chart-card">
          <header>
            <h4>Daily cost</h4>
            <span className="mono small subtle">USD · {days}d</span>
          </header>
          <div style={{ width: "100%", height: 200 }}>
            {dayQ.isLoading && <p className="text-[var(--color-stone)] text-[0.875rem]">Loading…</p>}
            {!dayQ.isLoading && chartData.length === 0 && (
              <p className="text-[var(--color-stone)] text-[0.875rem]">No data.</p>
            )}
            {!dayQ.isLoading && chartData.length > 0 && (
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(64% 0.16 35)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="oklch(64% 0.16 35)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(85% 0.005 50)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="oklch(55% 0.005 50)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="oklch(55% 0.005 50)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(99% 0.003 60)",
                      border: "1px solid oklch(85% 0.005 50)",
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      color: "oklch(20% 0.012 50)",
                    }}
                    labelStyle={{ color: "oklch(55% 0.005 50)", fontSize: 10, marginBottom: 4 }}
                    formatter={(v) => [formatUsd(Number(v)), "cost"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="oklch(64% 0.16 35)"
                    strokeWidth={1.5}
                    fill="url(#costGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="user-table">
          <header>
            <h4>By user</h4>
            <span className="mono small subtle">{userRows.length} active</span>
          </header>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th className="num">Generations</th>
                <th className="num">Cost</th>
                <th>Share</th>
                <th className="num">Avg latency</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((u) => (
                <tr key={u.userId}>
                  <td>
                    <span className="u-cell">
                      <span className="u-avatar">{u.name.charAt(0).toUpperCase()}</span>
                      {u.name}
                    </span>
                  </td>
                  <td className="num mono small">{u.calls.toLocaleString()}</td>
                  <td className="num mono small">{formatUsd(u.cost)}</td>
                  <td>
                    <span className="share-cell">
                      <span className="share-bar">
                        <span className="share-fill" style={{ width: `${u.share * 100}%` }}></span>
                      </span>
                      <span className="share-num">{Math.round(u.share * 100)}%</span>
                    </span>
                  </td>
                  <td className="num mono small">
                    {u.avgLatencyMs > 0 ? `${(u.avgLatencyMs / 1000).toFixed(1)}s` : "—"}
                  </td>
                </tr>
              ))}
              {userRows.length > 0 && (
                <tr>
                  <td>
                    <span
                      className="mono"
                      style={{
                        color: "var(--color-stone)",
                        fontSize: "0.625rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      total
                    </span>
                  </td>
                  <td className="num mono small">{userRows.reduce((s, r) => s + r.calls, 0).toLocaleString()}</td>
                  <td className="num mono small">{formatUsd(totalUserCost)}</td>
                  <td></td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
