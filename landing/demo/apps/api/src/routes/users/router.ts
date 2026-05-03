import { Hono } from "hono";
import { db, schema } from "@studio/db";
import { eq } from "drizzle-orm";

export const usersRouter = new Hono().get("/", async (c) => {
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(eq(schema.users.orgId, c.get("orgId")));
  return c.json(rows);
});
