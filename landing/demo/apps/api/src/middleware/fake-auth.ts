import type { MiddlewareHandler } from "hono";
import { db, schema } from "@studio/db";
import { eq } from "drizzle-orm";

let cached: { orgId: string; userId: string } | null = null;

async function loadSeedIdentity() {
  if (cached) return cached;
  const [org] = await db.select().from(schema.orgs).limit(1);
  if (!org) throw new Error("seed org missing — run pnpm db:seed");
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.orgId, org.id))
    .limit(1);
  if (!user) throw new Error("seed user missing — run pnpm db:seed");
  cached = { orgId: org.id, userId: user.id };
  return cached;
}

export const fakeAuth: MiddlewareHandler = async (c, next) => {
  const id = await loadSeedIdentity();
  c.set("orgId", id.orgId);
  c.set("userId", id.userId);
  await next();
};
