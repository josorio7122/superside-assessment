import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Result } from "@studio/db";
import { RepoError } from "@studio/db";

export function send<T>(c: Context, r: Result<T, RepoError>, ok: ContentfulStatusCode = 200) {
  if (r.ok) return c.json(r.value as Record<string, unknown> | unknown[], ok);
  const status: ContentfulStatusCode =
    r.error.kind === "not_found"
      ? 404
      : r.error.kind === "conflict"
        ? 409
        : r.error.kind === "validation"
          ? 400
          : 500;
  return c.json(
    {
      error: {
        kind: r.error.kind,
        message: r.error.message,
        requestId: c.get("requestId"),
      },
    },
    status,
  );
}
