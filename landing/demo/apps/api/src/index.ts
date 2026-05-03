import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { requestId } from "./middleware/request-id.js";
import { fakeAuth } from "./middleware/fake-auth.js";
import { errorBoundary } from "./middleware/error.js";

const app = new Hono();
app.use("*", requestId);
app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use("*", errorBoundary);

app.get("/healthz", (c) => c.json({ ok: true }));

app.use("/api/*", fakeAuth);
app.get("/api/me", async (c) =>
  c.json({ orgId: c.get("orgId"), userId: c.get("userId") }),
);

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port }, "api listening");
});

export type AppType = typeof app;
