import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { send } from "../../lib/result-to-http.js";
import { usageRepo } from "./repository.js";
import { UsageQuerySchema } from "./validator.js";

export const usageRouter = new Hono().get("/", zValidator("query", UsageQuerySchema), async (c) => {
  const q = c.req.valid("query");
  return send(c, await usageRepo.rollup(c.get("orgId"), q));
});
