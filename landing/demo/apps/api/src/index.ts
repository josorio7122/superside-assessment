import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { getPdf } from "./infra/storage.js";
import { logger } from "./logger.js";
import { errorBoundary } from "./middleware/error.js";
import { fakeAuth } from "./middleware/fake-auth.js";
import { requestId } from "./middleware/request-id.js";
import { brandRouter } from "./routes/brand/router.js";
import { profileRouter } from "./routes/brand-profile/router.js";
import { generationRouter } from "./routes/generation/router.js";
import { usageRouter } from "./routes/usage/router.js";
import { usersRouter } from "./routes/users/router.js";

const app = new Hono();
app.use("*", requestId);
app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use("*", errorBoundary);

app.get("/healthz", (c) => c.json({ ok: true }));

app.use("/api/*", fakeAuth);

app.get("/api/me", async (c) => c.json({ orgId: c.get("orgId"), userId: c.get("userId") }));

app.route("/api/brands", brandRouter);
app.route("/api", profileRouter);
app.route("/api/generations", generationRouter);
app.route("/api/usage", usageRouter);
app.route("/api/users", usersRouter);

app.get("/api/_storage/*", async (c) => {
  const path = c.req.path.replace(/^\/api\/_storage\//, "");
  const key = decodeURIComponent(path);
  try {
    const buf = await getPdf(key);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${key.split("/").pop()}"`,
      },
    });
  } catch (e) {
    logger.warn({ key, err: (e as Error).message }, "storage:not-found");
    return c.json({ error: { kind: "not_found", message: key } }, 404);
  }
});

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port }, "api listening");
});

export type AppType = typeof app;
