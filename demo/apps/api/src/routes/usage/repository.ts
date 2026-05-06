import { db, ok, schema } from "@studio/db";
import { and, eq, gte, sql } from "drizzle-orm";

export const usageRepo = {
  async rollup(orgId: string, opts: { groupBy: "user" | "brand" | "day" | "feature"; days: number }) {
    const since = new Date(Date.now() - opts.days * 24 * 3600_000);
    const where = and(eq(schema.usageEvents.orgId, orgId), gte(schema.usageEvents.createdAt, since));
    const groupExpr = (() => {
      switch (opts.groupBy) {
        case "user":
          return schema.usageEvents.userId;
        case "brand":
          return schema.usageEvents.brandId;
        case "feature":
          return schema.usageEvents.feature;
        default:
          return sql<string>`date_trunc('day', ${schema.usageEvents.createdAt})::text`;
      }
    })();

    const rows = await db
      .select({
        key: groupExpr,
        calls: sql<number>`count(*)::int`,
        inputTokens: sql<number>`coalesce(sum(${schema.usageEvents.inputTokens}),0)::int`,
        outputTokens: sql<number>`coalesce(sum(${schema.usageEvents.outputTokens}),0)::int`,
        costUsd: sql<string>`coalesce(sum(${schema.usageEvents.costUsd}),0)::text`,
        avgLatencyMs: sql<number>`coalesce(avg(${schema.usageEvents.latencyMs}),0)::int`,
      })
      .from(schema.usageEvents)
      .where(where)
      .groupBy(groupExpr)
      .orderBy(groupExpr);
    return ok(rows);
  },
};
