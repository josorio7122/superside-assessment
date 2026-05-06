import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { send, sendCreated } from "../../lib/result-to-http.js";
import { brandService } from "./service.js";
import { CreateBrandSchema, UpdateBrandSchema } from "./validator.js";

export const brandRouter = new Hono()
  .get("/", async (c) => send(c, await brandService.listWithStats(c.get("orgId"))))
  .post("/", zValidator("json", CreateBrandSchema), async (c) => {
    const body = c.req.valid("json");
    return sendCreated(c, await brandService.create(c.get("orgId"), body.name));
  })
  .get("/:brandId", async (c) => send(c, await brandService.getDetail(c.get("orgId"), c.req.param("brandId"))))
  .patch("/:brandId", zValidator("json", UpdateBrandSchema), async (c) => {
    const body = c.req.valid("json");
    const brandId = c.req.param("brandId");
    const orgId = c.get("orgId");
    if (body.archived) {
      return send(c, await brandService.softDelete(orgId, brandId));
    }
    if (body.name) {
      return send(c, await brandService.rename({ orgId, id: brandId, name: body.name }));
    }
    return c.json({ error: { kind: "validation", message: "no-op" } }, 400);
  });
