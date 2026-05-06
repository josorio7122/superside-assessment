import { db, err, firstOrInternal, ok, RepoError, type Result, schema } from "@studio/db";
import type { BrandProfile } from "@studio/schemas";
import { and, desc, eq, sql } from "drizzle-orm";

export type BrandProfileRow = typeof schema.brandProfiles.$inferSelect;

export const brandProfileRepo = {
  async listByBrand(orgId: string, brandId: string): Promise<Result<BrandProfileRow[], RepoError>> {
    const rows = await db
      .select()
      .from(schema.brandProfiles)
      .where(and(eq(schema.brandProfiles.orgId, orgId), eq(schema.brandProfiles.brandId, brandId)))
      .orderBy(desc(schema.brandProfiles.version));
    return ok(rows);
  },

  async getById(orgId: string, id: string): Promise<Result<BrandProfileRow, RepoError>> {
    const [row] = await db
      .select()
      .from(schema.brandProfiles)
      .where(and(eq(schema.brandProfiles.id, id), eq(schema.brandProfiles.orgId, orgId)));
    return row ? ok(row) : err(new RepoError("not_found", `profile ${id} not found`));
  },

  async insertProcessing(input: {
    orgId: string;
    brandId: string;
    userId: string;
    s3Key: string;
    filename: string;
    sizeBytes: number;
  }): Promise<Result<BrandProfileRow, RepoError>> {
    const next = await db.execute<{ next: number }>(
      sql`select coalesce(max(version),0)+1 as next from brand_profile where brand_id=${input.brandId}`,
    );
    const version = (next.rows[0]?.next as number) ?? 1;
    const rows = await db
      .insert(schema.brandProfiles)
      .values({
        orgId: input.orgId,
        brandId: input.brandId,
        version,
        profile: null,
        sourcePdfS3Key: input.s3Key,
        sourcePdfFilename: input.filename,
        sourcePdfSizeBytes: input.sizeBytes,
        status: "processing",
        isCurrent: false,
        createdBy: input.userId,
      })
      .returning();
    return firstOrInternal(rows, "insert returned no row");
  },

  async insertHandAuthored(input: {
    orgId: string;
    brandId: string;
    userId: string;
    profile: BrandProfile;
  }): Promise<Result<BrandProfileRow, RepoError>> {
    return db.transaction(async (tx) => {
      const next = await tx.execute<{ next: number }>(
        sql`select coalesce(max(version),0)+1 as next from brand_profile where brand_id=${input.brandId}`,
      );
      const version = (next.rows[0]?.next as number) ?? 1;
      await tx
        .update(schema.brandProfiles)
        .set({ isCurrent: false })
        .where(and(eq(schema.brandProfiles.brandId, input.brandId), eq(schema.brandProfiles.isCurrent, true)));
      const rows = await tx
        .insert(schema.brandProfiles)
        .values({
          orgId: input.orgId,
          brandId: input.brandId,
          version,
          profile: input.profile,
          status: "ready",
          isCurrent: true,
          createdBy: input.userId,
        })
        .returning();
      return firstOrInternal(rows, "insert returned no row");
    });
  },

  async editAsNewVersion(input: {
    orgId: string;
    profileId: string;
    userId: string;
    newProfile: BrandProfile;
  }): Promise<Result<BrandProfileRow, RepoError>> {
    return db.transaction(async (tx) => {
      const [prior] = await tx
        .select()
        .from(schema.brandProfiles)
        .where(and(eq(schema.brandProfiles.id, input.profileId), eq(schema.brandProfiles.orgId, input.orgId)));
      if (!prior) return err(new RepoError("not_found", `profile ${input.profileId} not found`));
      if (prior.status !== "ready") return err(new RepoError("conflict", "profile not ready"));
      const next = await tx.execute<{ next: number }>(
        sql`select coalesce(max(version),0)+1 as next from brand_profile where brand_id=${prior.brandId}`,
      );
      const version = (next.rows[0]?.next as number) ?? 1;
      await tx
        .update(schema.brandProfiles)
        .set({ isCurrent: false })
        .where(and(eq(schema.brandProfiles.brandId, prior.brandId), eq(schema.brandProfiles.isCurrent, true)));
      const rows = await tx
        .insert(schema.brandProfiles)
        .values({
          orgId: prior.orgId,
          brandId: prior.brandId,
          version,
          profile: input.newProfile,
          status: "ready",
          sourcePdfS3Key: prior.sourcePdfS3Key,
          sourcePdfFilename: prior.sourcePdfFilename,
          sourcePdfSizeBytes: prior.sourcePdfSizeBytes,
          isCurrent: true,
          createdBy: input.userId,
        })
        .returning();
      return firstOrInternal(rows, "insert returned no row");
    });
  },

  async setCurrent(orgId: string, profileId: string): Promise<Result<BrandProfileRow, RepoError>> {
    return db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(schema.brandProfiles)
        .where(and(eq(schema.brandProfiles.id, profileId), eq(schema.brandProfiles.orgId, orgId)));
      if (!target) return err(new RepoError("not_found", `profile ${profileId} not found`));
      if (target.status !== "ready") return err(new RepoError("conflict", "not a ready row"));
      await tx
        .update(schema.brandProfiles)
        .set({ isCurrent: false })
        .where(and(eq(schema.brandProfiles.brandId, target.brandId), eq(schema.brandProfiles.isCurrent, true)));
      const rows = await tx
        .update(schema.brandProfiles)
        .set({ isCurrent: true })
        .where(eq(schema.brandProfiles.id, profileId))
        .returning();
      return firstOrInternal(rows, "update returned no row");
    });
  },

  async markRetry(orgId: string, profileId: string): Promise<Result<BrandProfileRow, RepoError>> {
    const [row] = await db
      .update(schema.brandProfiles)
      .set({ status: "processing", ingestError: null })
      .where(
        and(
          eq(schema.brandProfiles.id, profileId),
          eq(schema.brandProfiles.orgId, orgId),
          eq(schema.brandProfiles.status, "failed"),
        ),
      )
      .returning();
    return row ? ok(row) : err(new RepoError("conflict", "profile not in failed state"));
  },

  async currentForBrand(orgId: string, brandId: string): Promise<Result<BrandProfileRow, RepoError>> {
    const [row] = await db
      .select()
      .from(schema.brandProfiles)
      .where(
        and(
          eq(schema.brandProfiles.orgId, orgId),
          eq(schema.brandProfiles.brandId, brandId),
          eq(schema.brandProfiles.isCurrent, true),
        ),
      );
    return row ? ok(row) : err(new RepoError("not_found", `no current profile for brand ${brandId}`));
  },
};
