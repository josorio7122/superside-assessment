import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { send } from "../../lib/result-to-http.js";
import { genRepo } from "./repository.js";
import { GenerationsQuerySchema } from "./validator.js";

export const generationRouter = new Hono()
  .get("/", zValidator("query", GenerationsQuerySchema), async (c) => {
    const q = c.req.valid("query");
    return send(c, await genRepo.list(c.get("orgId"), q));
  })
  .get("/:id", async (c) => send(c, await genRepo.getById(c.get("orgId"), c.req.param("id"))));
