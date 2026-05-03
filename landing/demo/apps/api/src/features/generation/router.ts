import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { GenerationsQuerySchema } from "@studio/schemas";
import { genRepo } from "./repository.js";
import { send } from "../../lib/result-to-http.js";

export const generationRouter = new Hono()
  .get("/", zValidator("query", GenerationsQuerySchema), async (c) => {
    const q = c.req.valid("query");
    return send(c, await genRepo.list(c.get("orgId"), q));
  })
  .get("/:id", async (c) => send(c, await genRepo.getById(c.get("orgId"), c.req.param("id"))));
