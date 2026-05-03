import { db, schema, ok } from "@studio/db";
import { and, eq, gte, sql } from "drizzle-orm";

export const usageRepo = {
  async rollup(
    orgId: string,
    opts: { groupBy: "user" | "brand" | "day" | "feature"; days: number },
  ) {
    const since = new Date(Date.now() - opts.days * 24 * 3600_000);
    const where = and(
      eq(schema.usageEvents.orgId, orgId),
      gte(schema.usageEvents.createdAt, since),
    );
    const groupExpr =
      opts.groupBy === "user"
        ? schema.usageEvents.userId
        : opts.groupBy === "brand"
          ? schema.usageEvents.brandId
          : opts.groupBy === "feature"
            ? schema.usageEvents.feature
            : sql<string>`date_trunc('day', ${schema.usageEvents.createdAt})::text`;

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
