# Usage Dashboard

Per-user usage view. The simplest cut that satisfies N4 ("usage metering & cost attribution by user") for the pilot.

## Goals

- Show every user in the org with how much they've generated and what it cost, over a chosen time window.
- Show a daily cost chart over the same time window so trends are visible at a glance.
- Reuse the `usage_event` data already being written by every text and image generation.

## Non-goals (this design)

- Breakdowns by brand, feature, locale, model, provider — all deferred.
- Drill-down into a user's specific generations — depends on `generations-history` gaining a `?user=<id>` filter, which is also deferred.
- CSV export — `generations-history.md` already exports raw rows; no need to duplicate.
- Spend caps and alerts (B8) — out of MVP per scope.

## Storage decision

Plain Postgres against `usage_event`, no columnar / warehouse system. At pilot scale (~30K events/month) and even at 12-month projection (~400K events/month), Postgres handles every dashboard query in well under 100ms with the existing composite indexes. The table is treated as append-only, which leaves the door open to migrate to a warehouse or pre-aggregated rollups later if scale ever demands it.

## Actors

- **Org member** — any authenticated user. Sees the usage table for their own org.

## Data model

No new tables. Reads from `usage_event` (every LLM API call) and joins to `user` for display name.

## API

### `GET /api/usage/cost-timeseries`

Daily cost totals for the org, bucketed by calendar day in the org's timezone.

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `range` | `today` \| `7d` \| `30d` | `7d` | Resolves to the same lower bound as the by-user endpoint |

**Response**

```jsonc
{
  "range": "7d",
  "buckets": [
    { "date": "2026-04-26", "cost_usd": 0.42 },
    { "date": "2026-04-27", "cost_usd": 0.61 },
    { "date": "2026-04-28", "cost_usd": 0.55 },
    { "date": "2026-04-29", "cost_usd": 1.08 },
    { "date": "2026-04-30", "cost_usd": 0.87 },
    { "date": "2026-05-01", "cost_usd": 0.36 },
    { "date": "2026-05-02", "cost_usd": 0.31 }
  ]
}
```

- One row per calendar day in the window. Days with zero usage are returned with `cost_usd: 0` so the chart has a continuous x-axis.
- For `range=today`, returns a single bucket (today's total). The chart just renders one bar — fine.

**Server query (sketch)**

```sql
select date_trunc('day', ue.created_at)::date as date,
       coalesce(sum(ue.cost_usd), 0)::numeric(10,6) as cost_usd
from usage_event ue
where ue.org_id = $1
  and ue.created_at >= $2
group by 1
order by 1 asc;
```

Empty days are filled in by the application layer (left-join against a generated date series client-side or in the API).

### `GET /api/usage/by-user`

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `range` | `today` \| `7d` \| `30d` | `7d` | Server-resolved to a `created_at` lower bound |

**Response**

```jsonc
{
  "range": "7d",
  "users": [
    {
      "user": { "id": "uuid", "name": "Jo Osorio" },
      "generation_count": 142,
      "total_cost_usd": 4.20,
      "last_activity_at": "2026-05-02T10:42:11Z"
    },
    {
      "user": { "id": "uuid", "name": "Maya R." },
      "generation_count": 87,
      "total_cost_usd": 2.15,
      "last_activity_at": "2026-05-02T09:11:00Z"
    }
  ]
}
```

Sort: `last_activity_at desc`. Users with zero activity in the window are omitted.

**Server query (sketch)**

```sql
select
  u.id, u.name,
  count(distinct ue.generation_id) as generation_count,
  sum(ue.cost_usd) as total_cost_usd,
  max(ue.created_at) as last_activity_at
from usage_event ue
join "user" u on u.id = ue.user_id
where ue.org_id = $1
  and ue.created_at >= $2  -- range lower bound
group by u.id, u.name
order by last_activity_at desc;
```

Backed by index `(org_id, user_id, created_at desc)` already specified in `data-model.md`.

### Errors

| Status | Reason |
|--------|--------|
| `400` | Unsupported `range` value |
| `401` | No session |

## UI

Single page at `/usage`. One range control drives both the chart and the table.

```
┌────────────────────────────────────────────────────────────────┐
│  Usage                                                         │
│                                                                │
│  [Today]  [7d]  [30d]                                          │
│                                                                │
│  ── Daily cost ──────────────────────────────                  │
│                                                                │
│   $1.20 ┤                       ▇                              │
│   $0.90 ┤              ▇        ▇      ▇                       │
│   $0.60 ┤    ▇    ▇    ▇        ▇      ▇    ▇    ▇             │
│   $0.30 ┤    ▇    ▇    ▇        ▇      ▇    ▇    ▇             │
│         └────┴────┴────┴────┴───┴──────┴────┴────┴──── days    │
│                                                                │
│  ── Per user ────────────────────────────────                  │
│                                                                │
│  User              Generations    Cost      Last activity     │
│  ────────────────────────────────────────────────────────────│
│  Jo Osorio              142     $4.20      2 min ago          │
│  Maya R.                 87     $2.15      1 hr ago           │
│  Pat C.                  43     $0.98      yesterday          │
│  …                                                            │
└────────────────────────────────────────────────────────────────┘
```

### Chart

- Bar chart, one bar per calendar day in the selected window.
- Y-axis: USD. X-axis: date.
- Hover tooltip shows the exact value for that day.
- For `Today`, a single bar.
- Empty days render as zero-height bars so the time axis stays continuous.
- Implementation: a small charting lib (Recharts or similar). No need for a heavy BI library.

### Table

- Three data columns + last-activity timestamp.
- Last activity displayed relative ("2 min ago"), absolute on hover.
- Empty state: "No usage in this window."
- No filters, no search, no drill-down.

## Performance considerations

- Two grouped scans of `usage_event` filtered by `(org_id, created_at >= …)`: one grouped by user, one grouped by day. At pilot scale both are microseconds; even at 400K rows/month projection, well under 100ms each.
- If the table ever grows to where these queries exceed a few hundred ms, add a daily rollup table populated by cron (e.g. `daily_usage_by_user`, with `(date, user_id, cost_usd, generation_count)`). Both endpoints map cleanly onto it. Not needed now.

## Decisions locked

| Decision | Resolution |
|----------|------------|
| Storage | Plain Postgres on `usage_event`. No columnar DB. |
| Breakdowns | By user only. No brand / feature / locale / model. |
| Time ranges | Three presets: Today / 7d / 30d. No custom range. |
| Columns | User name, generations count, total cost USD, last activity. |
| Sort | Last activity, descending. |
| Chart | Daily cost, bar chart. Same time range as the table. |
| Drill-down | None. |
| CSV | None. |
| Visibility | Org-wide. Any org member sees this page. |

## Out of scope

- Brand / feature / locale / model / provider breakdowns
- Drill-down into per-user generations
- CSV / data export from this page
- Cost-per-asset rollup (B7)
- Spend caps + alerts (B8)
- Pre-aggregated rollup tables (only if performance demands)
- Warehouse / columnar storage migration (only if data volume demands)
- Charts beyond the daily cost bars (latency trend, cost split, etc.)
