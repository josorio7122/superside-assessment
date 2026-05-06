export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export type RepoErrorKind = "not_found" | "conflict" | "validation" | "internal";
export class RepoError extends Error {
  constructor(
    public kind: RepoErrorKind,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Wraps a `.returning()` (or any single-row) query result.
 * If the array is empty, returns an `internal` RepoError with the given message.
 * Use for inserts/updates that must produce exactly one row.
 */
export function firstOrInternal<T>(rows: T[], message: string): Result<T, RepoError> {
  const [row] = rows;
  return row ? ok(row) : err(new RepoError("internal", message));
}
