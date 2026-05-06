import { db, err, ok, RepoError, schema } from "@studio/db";
import { and, desc, eq, lt } from "drizzle-orm";

export const genRepo = {
  async list(
    orgId: string,
    q: {
      brandId?: string;
      type?: "copy_variant" | "translate" | "image";
      status?: "pending" | "running" | "done" | "failed";
      userId?: string;
      limit: number;
      cursor?: string;
    },
  ) {
    const filters = [eq(schema.generations.orgId, orgId)];
    if (q.brandId) filters.push(eq(schema.generations.brandId, q.brandId));
    if (q.type) filters.push(eq(schema.generations.type, q.type));
    if (q.status) filters.push(eq(schema.generations.status, q.status));
    if (q.userId) filters.push(eq(schema.generations.userId, q.userId));
    if (q.cursor) filters.push(lt(schema.generations.createdAt, new Date(q.cursor)));
    const rows = await db
      .select()
      .from(schema.generations)
      .where(and(...filters))
      .orderBy(desc(schema.generations.createdAt))
      .limit(q.limit);
    const last = rows[rows.length - 1];
    const nextCursor = rows.length === q.limit && last ? last.createdAt.toISOString() : null;
    return ok({ items: rows, nextCursor });
  },
  async getById(orgId: string, id: string) {
    const [row] = await db
      .select()
      .from(schema.generations)
      .where(and(eq(schema.generations.id, id), eq(schema.generations.orgId, orgId)));
    return row ? ok(row) : err(new RepoError("not_found", `generation ${id} not found`));
  },

  async create(input: {
    orgId: string;
    brandId: string;
    userId: string;
    inputJson: unknown;
  }) {
    const [row] = await db
      .insert(schema.generations)
      .values({
        orgId: input.orgId,
        brandId: input.brandId,
        userId: input.userId,
        type: "image",
        status: "running",
        input: input.inputJson,
        output: null,
        figmaFileKey: null,
        figmaNodeId: null,
        startedAt: new Date(),
      })
      .returning();
    if (!row) return err(new RepoError("internal", "insert returned no row"));
    return ok(row);
  },
};
