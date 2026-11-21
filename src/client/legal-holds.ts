/**
 * Legal holds (WEB-1301, M10.3, M10.7). The administrator reads the active holds, places one
 * (subject and case reference) and releases one with a reason. A hold the signed-in
 * administrator placed has `own: true`; the server refuses its release by the same person
 * (403), and the page shows that button inert. The contract is provisional (no server route
 * yet), see migration-contracts.generated.json.
 */

import { createApi, type ApiOptions, type ApiResult } from "./api";

type ListBody = Extract<ApiResult<"institution.legal-holds.get">, { ok: true }>["body"];
export type LegalHoldRow = ListBody["holds"][number];

export type FailedKind = "signedOut" | "denied" | "unavailable";
export type LegalHoldsOutcome = { kind: "ok"; holds: readonly LegalHoldRow[] } | { kind: FailedKind };
/** `invalid`: the server refused the values (422); `stale`: the hold is gone or already released (404, 409). */
export type LegalHoldActionOutcome = { kind: "ok" } | { kind: FailedKind | "invalid" | "stale" };

function failed(status: number): FailedKind {
  if (status === 401) return "signedOut";
  return status === 403 ? "denied" : "unavailable";
}

export async function fetchLegalHolds(options: ApiOptions = {}): Promise<LegalHoldsOutcome> {
  let result: ApiResult<"institution.legal-holds.get">;
  try {
    result = await createApi(options)("institution.legal-holds.get", { params: undefined, query: undefined, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  return result.ok ? { kind: "ok", holds: result.body.holds } : { kind: failed(result.status) };
}

function actionFailure(status: number): LegalHoldActionOutcome {
  // 0: the client refused the input before sending (a value the contract does not allow).
  if (status === 0 || status === 422) return { kind: "invalid" };
  if (status === 404 || status === 409) return { kind: "stale" };
  return { kind: failed(status) };
}

/** Places a hold; the subject and the case reference are trimmed and sent as they are. */
export async function placeLegalHold(input: { subject: string; caseReference: string }, options: ApiOptions = {}): Promise<LegalHoldActionOutcome> {
  let result: ApiResult<"institution.legal-holds.post">;
  try {
    result = await createApi(options)("institution.legal-holds.post", {
      params: undefined, query: undefined,
      body: { subject: input.subject.trim(), caseReference: input.caseReference.trim() },
    });
  } catch {
    return { kind: "unavailable" };
  }
  return result.ok ? { kind: "ok" } : actionFailure(result.status);
}

/** Releases the hold `id` with a reason. */
export async function releaseLegalHold(id: string, reason: string, options: ApiOptions = {}): Promise<LegalHoldActionOutcome> {
  let result: ApiResult<"institution.legal-hold-release.post">;
  try {
    result = await createApi(options)("institution.legal-hold-release.post", {
      params: { holdId: id }, query: undefined, body: { reason: reason.trim() },
    });
  } catch {
    return { kind: "unavailable" };
  }
  return result.ok ? { kind: "ok" } : actionFailure(result.status);
}
