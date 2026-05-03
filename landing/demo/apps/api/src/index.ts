import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { requestId } from "./middleware/request-id.js";
import { fakeAuth } from "./middleware/fake-auth.js";
import { errorBoundary } from "./middleware/error.js";
import { brandRouter } from "./features/brand/router.js";
import { profileRouter } from "./features/brand-profile/router.js";
import { generationRouter } from "./features/generation/router.js";
import { usageRouter } from "./features/usage/router.js";
import { usersRouter } from "./features/users/router.js";
import { readLocalForRoute } from "./infra/storage.js";

const app = new Hono();
app.use("*", requestId);
app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use("*", errorBoundary);

app.get("/healthz", (c) => c.json({ ok: true }));

app.use("/api/*", fakeAuth);

app.get("/api/me", async (c) =>
  c.json({ orgId: c.get("orgId"), userId: c.get("userId") }),
);

app.route("/api/brands", brandRouter);
app.route("/api", profileRouter);
app.route("/api/generations", generationRouter);
app.route("/api/usage", usageRouter);
app.route("/api/users", usersRouter);

app.get("/api/_storage/:key", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  try {
    const buf = await readLocalForRoute(key);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf" } });
  } catch {
    return c.json({ error: { kind: "not_found", message: key } }, 404);
  }
});

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port }, "api listening");
});

export type AppType = typeof app;
