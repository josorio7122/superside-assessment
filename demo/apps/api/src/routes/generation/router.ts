import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { CreateImageGenerationSchema } from "@studio/schemas";
import { streamGenerationEvents } from "../../infra/sse.js";
import { send, sendCreated } from "../../lib/result-to-http.js";
import { genRepo } from "./repository.js";
import { generationService } from "./service.js";
import { GenerationsQuerySchema } from "./validator.js";

export const generationRouter = new Hono()
  .get("/", zValidator("query", GenerationsQuerySchema), async (c) => {
    const q = c.req.valid("query");
    return send(c, await genRepo.list(c.get("orgId"), q));
  })
  .get("/:id", async (c) => send(c, await genRepo.getById(c.get("orgId"), c.req.param("id"))))
  .get("/:id/events", (c) => streamGenerationEvents(c, c.req.param("id")))
  .post("/image", zValidator("json", CreateImageGenerationSchema), async (c) =>
    sendCreated(
      c,
      await generationService.createImage({
        orgId: c.get("orgId"),
        userId: c.get("userId"),
        body: c.req.valid("json"),
      }),
    ),
  );
