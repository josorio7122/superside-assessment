import type { RepoError, Result } from "@studio/db";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const errorStatus: Record<RepoError["kind"], ContentfulStatusCode> = {
  not_found: 404,
  conflict: 409,
  validation: 400,
  internal: 500,
};

function respond<T>(input: { c: Context; r: Result<T, RepoError>; ok: ContentfulStatusCode }) {
  const { c, r, ok } = input;
  if (r.ok) return c.json(r.value as Record<string, unknown> | unknown[], ok);
  return c.json(
    {
      error: {
        kind: r.error.kind,
        message: r.error.message,
        requestId: c.get("requestId"),
      },
    },
    errorStatus[r.error.kind] ?? 500,
  );
}

export function send<T>(c: Context, r: Result<T, RepoError>) {
  return respond({ c, r, ok: 200 });
}

export function sendCreated<T>(c: Context, r: Result<T, RepoError>) {
  return respond({ c, r, ok: 201 });
}

export function sendAccepted<T>(c: Context, r: Result<T, RepoError>) {
  return respond({ c, r, ok: 202 });
}
