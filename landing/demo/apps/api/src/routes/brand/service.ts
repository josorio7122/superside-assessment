import { brandRepo } from "./repository.js";
import { db, schema, ok } from "@studio/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";

export const brandService = {
  list: brandRepo.list,
  create: brandRepo.create,
  rename: brandRepo.rename,
  softDelete: brandRepo.softDelete,

  async getDetail(orgId: string, id: string) {
    const r = await brandRepo.getById(orgId, id);
    if (!r.ok) return r;

    const [currentProfile] = await db
      .select()
      .from(schema.brandProfiles)
      .where(
        and(
          eq(schema.brandProfiles.brandId, id),
          eq(schema.brandProfiles.isCurrent, true),
        ),
      )
      .limit(1);

    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const [stats] = await db
      .select({
        genCount30d: sql<number>`count(*)::int`,
        lastActivityAt: sql<Date | null>`max(${schema.generations.createdAt})`,
      })
      .from(schema.generations)
      .where(
        and(eq(schema.generations.brandId, id), gte(schema.generations.createdAt, since)),
      );

    return ok({
      brand: r.value,
      currentProfile: currentProfile ?? null,
      stats: stats ?? { genCount30d: 0, lastActivityAt: null },
    });
  },

  async listWithStats(orgId: string) {
    const r = await brandRepo.list(orgId);
    if (!r.ok) return r;
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const stats = await db
      .select({
        brandId: schema.generations.brandId,
        genCount30d: sql<number>`count(*)::int`,
        lastActivityAt: sql<Date | null>`max(${schema.generations.createdAt})`,
      })
      .from(schema.generations)
      .where(and(eq(schema.generations.orgId, orgId), gte(schema.generations.createdAt, since)))
      .groupBy(schema.generations.brandId);
    const statsByBrand = new Map(stats.map((s) => [s.brandId, s]));

    // Status of the LATEST version (max version per brand), not just the
    // is_current row, so a re-upload in flight surfaces as "Processing"
    // even while the prior ready row remains current.
    const latest = await db
      .select({
        brandId: schema.brandProfiles.brandId,
        status: schema.brandProfiles.status,
        version: schema.brandProfiles.version,
      })
      .from(schema.brandProfiles)
      .where(eq(schema.brandProfiles.orgId, orgId));

    const latestByBrand = new Map<string, { status: string; version: number }>();
    for (const row of latest) {
      const prev = latestByBrand.get(row.brandId);
      if (!prev || row.version > prev.version) {
        latestByBrand.set(row.brandId, { status: row.status, version: row.version });
      }
    }

    return ok(
      r.value.map((b) => ({
        ...b,
        genCount30d: statsByBrand.get(b.id)?.genCount30d ?? 0,
        lastActivityAt: statsByBrand.get(b.id)?.lastActivityAt ?? null,
        profileStatus: latestByBrand.get(b.id)?.status ?? null,
      })),
    );
  },
};
