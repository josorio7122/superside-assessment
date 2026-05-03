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
    public cause?: unknown,
  ) {
    super(message);
  }
}
