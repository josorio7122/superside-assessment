import type { MiddlewareHandler } from "hono";
import { logger } from "../logger.js";

export const errorBoundary: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (e) {
    logger.error({ err: e, requestId: c.get("requestId") }, "unhandled");
    return c.json(
      {
        error: {
          kind: "internal",
          message: "internal error",
          requestId: c.get("requestId"),
        },
      },
      500,
    );
  }
};
