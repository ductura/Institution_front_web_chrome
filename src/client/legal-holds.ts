/**
 * Legal holds (WEB-1301, M10.3, M10.7; server shape since LOK-WEB-4, openapi v1). The
 * administrator reads the active holds, places one on a subject (a work, a student or an
 * assignment, named by its id) with a case reference, and releases one with a reason.
 * The server lists released holds too; the page shows only the active ones. It names who
 * placed a hold only by an internal id, which the page never shows. The server refuses the
 * release of a hold by the person who placed it (403), so a denied release may mean that.
 */

import { createApi, type ApiOptions, type ApiResult } from "./api";

type ListBody = Extract<ApiResult<"institution.legal-holds.get">, { ok: true }>["body"];
type WireHold = ListBody["holds"][number];
export type LegalHoldSubjectType = WireHold["subjectType"];

/** One active hold as the page shows it. */
export type LegalHoldRow = {
  readonly id: string;
  readonly subjectType: LegalHoldSubjectType;
  readonly subjectId: string;
  readonly caseReference: string;
  readonly placedAt: string;
};

export type FailedKind = "signedOut" | "denied" | "unavailable";
export type LegalHoldsOutcome = { kind: "ok"; holds: readonly LegalHoldRow[] } | { kind: FailedKind };
/**
 * `invalid`: the server refused the values (422); `stale`: the hold is gone or already released
 * (404, 409 on release); `missingSubject`: the institution has no such subject (404 on place).
 */
export type LegalHoldActionOutcome = { kind: "ok" } | { kind: FailedKind | "invalid" | "stale" | "missingSubject" };

function failed(status: number): FailedKind {
  if (status === 401) return "signedOut";
  return status === 403 ? "denied" : "unavailable";
}

/** A hold twice, or a release time without who released it (or the reverse), is an answer the page does not trust. */
const consistent = (holds: readonly WireHold[]): boolean =>
  new Set(holds.map((h) => h.holdId)).size === holds.length && holds.every((h) => (h.releasedAt === null) === (h.releasedBy === null));

const toRow = (h: WireHold): LegalHoldRow => ({
  id: h.holdId, subjectType: h.subjectType, subjectId: h.subjectId, caseReference: h.caseReference, placedAt: h.placedAt,
});

export async function fetchLegalHolds(options: ApiOptions = {}): Promise<LegalHoldsOutcome> {
  let result: ApiResult<"institution.legal-holds.get">;
  try {
    result = await createApi(options)("institution.legal-holds.get", { params: undefined, query: undefined, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  if (!result.ok) return { kind: failed(result.status) };
  if (!consistent(result.body.holds)) return { kind: "unavailable" };
  return { kind: "ok", holds: result.body.holds.filter((h) => h.releasedAt === null).map(toRow) };
}

function actionFailure(status: number, notFound: "stale" | "missingSubject"): LegalHoldActionOutcome {
  // 0: the client refused the input before sending (a value the contract does not allow).
  if (status === 0 || status === 422) return { kind: "invalid" };
  if (status === 404) return { kind: notFound };
  if (status === 409) return { kind: "stale" };
  return { kind: failed(status) };
}

/** Places a hold; the subject id and the case reference are trimmed and sent as they are. */
export async function placeLegalHold(
  input: { subjectType: LegalHoldSubjectType; subjectId: string; caseReference: string },
  options: ApiOptions = {},
): Promise<LegalHoldActionOutcome> {
  let result: ApiResult<"institution.legal-holds.post">;
  try {
    result = await createApi(options)("institution.legal-holds.post", {
      params: undefined, query: undefined,
      body: { subjectType: input.subjectType, subjectId: input.subjectId.trim(), caseReference: input.caseReference.trim() },
    });
  } catch {
    return { kind: "unavailable" };
  }
  return result.ok ? { kind: "ok" } : actionFailure(result.status, "missingSubject");
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
  return result.ok ? { kind: "ok" } : actionFailure(result.status, "stale");
}
