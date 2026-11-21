/**
 * The data classes read (WEB-1301, M10.7, A-05). The institution retention read answers
 * 200 `{classes}`: each class with its retention period in days (null until the period is
 * decided) and its mode, `dry_run` (a trial pass that deletes nothing) or `delete`.
 * The page only reads; there is no call here that changes or deletes anything.
 * The contract is provisional (no server route yet), see migration-contracts.generated.json.
 */

import { createApi, type ApiOptions, type ApiResult } from "./api";

type Body = Extract<ApiResult<"institution.retention.get">, { ok: true }>["body"];
export type RetentionClassRow = Body["classes"][number];

export type RetentionOutcome =
  | { kind: "ok"; classes: readonly RetentionClassRow[] }
  | { kind: "signedOut" | "denied" | "unavailable" };

/** Asks for the data classes. 401 is signed out, 403 is denied; anything else that is not a 200 is unavailable. */
export async function fetchRetention(options: ApiOptions = {}): Promise<RetentionOutcome> {
  let result: ApiResult<"institution.retention.get">;
  try {
    result = await createApi(options)("institution.retention.get", { params: undefined, query: undefined, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  if (result.ok) return { kind: "ok", classes: result.body.classes };
  if (result.status === 401) return { kind: "signedOut" };
  return { kind: result.status === 403 ? "denied" : "unavailable" };
}
