import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { UsageQuerySchema } from "@studio/schemas";
import { usageRepo } from "./repository.js";
import { send } from "../../lib/result-to-http.js";

export const usageRouter = new Hono().get(
  "/",
  zValidator("query", UsageQuerySchema),
  async (c) => {
    const q = c.req.valid("query");
    return send(c, await usageRepo.rollup(c.get("orgId"), q));
  },
);
