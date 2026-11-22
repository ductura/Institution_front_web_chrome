/**
 * The data classes read (WEB-1301, M10.7, A-05). The institution retention read answers
 * 200 `{classes}` in the server's shape (LOK-WEB-3, openapi v1): per class its `key`, its
 * message key `label`, its period in days (null until decided), its mode (`execute` or
 * `dry-run`), how many rows a deletion would take and the time of the last run.
 * The page only reads; there is no call here that changes or deletes anything.
 */

import { createApi, type ApiOptions, type ApiResult } from "./api";

type Body = Extract<ApiResult<"institution.retention.get">, { ok: true }>["body"];
type WireClass = Body["classes"][number];
export type RetentionKey = WireClass["key"];

/** One class as the page shows it: the page names it by `key` from its own catalogue. */
export type RetentionClassRow = {
  readonly key: RetentionKey;
  readonly retentionDays: number | null;
  /** `delete` for the server's `execute`, `dry_run` (a trial pass that deletes nothing) for `dry-run`. */
  readonly mode: "dry_run" | "delete";
  readonly candidates: number | null;
  readonly lastRunAt: string | null;
};

export type RetentionOutcome =
  | { kind: "ok"; classes: readonly RetentionClassRow[] }
  | { kind: "signedOut" | "denied" | "unavailable" };

const toRow = (c: WireClass): RetentionClassRow => ({
  key: c.key,
  retentionDays: c.retentionDays,
  mode: c.mode === "execute" ? "delete" : "dry_run",
  candidates: c.candidates,
  lastRunAt: c.lastRunAt,
});

/**
 * A class twice, or a class without a period that would delete, contradicts the server's rules
 * (a null period is always a dry run); such an answer is unavailable, never shown.
 */
const consistent = (classes: readonly WireClass[]): boolean =>
  new Set(classes.map((c) => c.key)).size === classes.length && classes.every((c) => c.retentionDays !== null || c.mode === "dry-run");

/** Asks for the data classes. 401 is signed out, 403 is denied; anything else that is not a 200 is unavailable. */
export async function fetchRetention(options: ApiOptions = {}): Promise<RetentionOutcome> {
  let result: ApiResult<"institution.retention.get">;
  try {
    result = await createApi(options)("institution.retention.get", { params: undefined, query: {}, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  if (result.ok) return consistent(result.body.classes) ? { kind: "ok", classes: result.body.classes.map(toRow) } : { kind: "unavailable" };
  if (result.status === 401) return { kind: "signedOut" };
  return { kind: result.status === 403 ? "denied" : "unavailable" };
}
