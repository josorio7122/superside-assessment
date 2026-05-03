import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { CreateBrandSchema, UpdateBrandSchema } from "@studio/schemas";
import { brandService } from "./service.js";
import { send } from "../../lib/result-to-http.js";

export const brandRouter = new Hono()
  .get("/", async (c) => send(c, await brandService.listWithStats(c.get("orgId"))))
  .post("/", zValidator("json", CreateBrandSchema), async (c) => {
    const body = c.req.valid("json");
    return send(c, await brandService.create(c.get("orgId"), body.name), 201);
  })
  .get("/:brandId", async (c) =>
    send(c, await brandService.getDetail(c.get("orgId"), c.req.param("brandId"))),
  )
  .patch("/:brandId", zValidator("json", UpdateBrandSchema), async (c) => {
    const body = c.req.valid("json");
    if (body.archived) {
      return send(c, await brandService.softDelete(c.get("orgId"), c.req.param("brandId")));
    }
    if (body.name) {
      return send(
        c,
        await brandService.rename(c.get("orgId"), c.req.param("brandId"), body.name),
      );
    }
    return c.json({ error: { kind: "validation", message: "no-op" } }, 400);
  });
