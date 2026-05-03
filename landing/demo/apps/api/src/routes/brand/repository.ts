import { db, schema, ok, err, RepoError, type Result } from "@studio/db";
import { and, eq, isNull, sql } from "drizzle-orm";

export type Brand = typeof schema.brands.$inferSelect;

export const brandRepo = {
  async list(orgId: string): Promise<Result<Brand[], RepoError>> {
    const rows = await db
      .select()
      .from(schema.brands)
      .where(and(eq(schema.brands.orgId, orgId), isNull(schema.brands.deletedAt)))
      .orderBy(schema.brands.name);
    return ok(rows);
  },
  async create(orgId: string, name: string): Promise<Result<Brand, RepoError>> {
    const [row] = await db.insert(schema.brands).values({ orgId, name }).returning();
    return ok(row!);
  },
  async getById(orgId: string, id: string): Promise<Result<Brand, RepoError>> {
    const [row] = await db
      .select()
      .from(schema.brands)
      .where(and(eq(schema.brands.id, id), eq(schema.brands.orgId, orgId)));
    return row ? ok(row) : err(new RepoError("not_found", `brand ${id} not found`));
  },
  async rename(orgId: string, id: string, name: string): Promise<Result<Brand, RepoError>> {
    const [row] = await db
      .update(schema.brands)
      .set({ name })
      .where(and(eq(schema.brands.id, id), eq(schema.brands.orgId, orgId)))
      .returning();
    return row ? ok(row) : err(new RepoError("not_found", `brand ${id} not found`));
  },
  async softDelete(orgId: string, id: string): Promise<Result<Brand, RepoError>> {
    const [row] = await db
      .update(schema.brands)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(schema.brands.id, id), eq(schema.brands.orgId, orgId)))
      .returning();
    return row ? ok(row) : err(new RepoError("not_found", `brand ${id} not found`));
  },
};
