import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { BrandProfileSchema, UpdateProfileSchema } from "@studio/schemas";
import { brandProfileService } from "./service.js";
import { send } from "../../lib/result-to-http.js";
import { streamProfileEvents } from "../../infra/sse.js";

const HandAuthorBody = z.object({ profile: BrandProfileSchema.optional() });

export const profileRouter = new Hono();

profileRouter.get("/brands/:brandId/profiles", async (c) =>
  send(c, await brandProfileService.list(c.get("orgId"), c.req.param("brandId"))),
);

profileRouter.post("/brands/:brandId/profiles", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const brandId = c.req.param("brandId");
  const ct = c.req.header("content-type") ?? "";

  if (ct.startsWith("multipart/form-data")) {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: { kind: "validation", message: "file required" } }, 400);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const r = await brandProfileService.createFromPdf({
      orgId,
      brandId,
      userId,
      file: { buffer: buf, name: file.name, size: buf.length },
    });
    return send(c, r, 202);
  }

  const raw = await c.req.json().catch(() => ({}));
  const body = HandAuthorBody.parse(raw);
  return send(
    c,
    await brandProfileService.createHandAuthored({
      orgId,
      brandId,
      userId,
      profile: body.profile,
    }),
    201,
  );
});

profileRouter.get("/profiles/:profileId", async (c) =>
  send(c, await brandProfileService.get(c.get("orgId"), c.req.param("profileId"))),
);

profileRouter.put(
  "/profiles/:profileId",
  zValidator("json", UpdateProfileSchema),
  async (c) => {
    const body = c.req.valid("json");
    return send(
      c,
      await brandProfileService.edit({
        orgId: c.get("orgId"),
        userId: c.get("userId"),
        profileId: c.req.param("profileId"),
        newProfile: body.profile,
      }),
    );
  },
);

profileRouter.post("/profiles/:profileId/retry", async (c) =>
  send(
    c,
    await brandProfileService.retry(
      c.get("orgId"),
      c.get("userId"),
      c.req.param("profileId"),
    ),
  ),
);

profileRouter.post("/profiles/:profileId/set-current", async (c) =>
  send(c, await brandProfileService.setCurrent(c.get("orgId"), c.req.param("profileId"))),
);

profileRouter.get("/profiles/:profileId/events", (c) =>
  streamProfileEvents(c, c.req.param("profileId")),
);
