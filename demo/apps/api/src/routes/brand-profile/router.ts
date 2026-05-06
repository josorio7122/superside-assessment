import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamProfileEvents } from "../../infra/sse.js";
import { send, sendAccepted, sendCreated } from "../../lib/result-to-http.js";
import { brandProfileService } from "./service.js";
import { HandAuthorBody, UpdateProfileSchema } from "./validator.js";

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
    return sendAccepted(c, r);
  }

  const raw = await c.req.json().catch(() => ({}));
  const body = HandAuthorBody.parse(raw);
  return sendCreated(
    c,
    await brandProfileService.createHandAuthored({
      orgId,
      brandId,
      userId,
      profile: body.profile,
    }),
  );
});

profileRouter.get("/profiles/:profileId", async (c) =>
  send(c, await brandProfileService.get(c.get("orgId"), c.req.param("profileId"))),
);

profileRouter.put("/profiles/:profileId", zValidator("json", UpdateProfileSchema), async (c) => {
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
});

profileRouter.post("/profiles/:profileId/retry", async (c) =>
  send(
    c,
    await brandProfileService.retry({
      orgId: c.get("orgId"),
      userId: c.get("userId"),
      profileId: c.req.param("profileId"),
    }),
  ),
);

profileRouter.post("/profiles/:profileId/set-current", async (c) =>
  send(c, await brandProfileService.setCurrent(c.get("orgId"), c.req.param("profileId"))),
);

profileRouter.get("/profiles/:profileId/events", (c) => streamProfileEvents(c, c.req.param("profileId")));
