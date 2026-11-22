/**
 * The teacher returns a whole work for revision (WEB-2155B; N-07, N-06, dialog dd-h).
 *
 * `work.return-for-revision.post` of the generated extract, reached only through `createApi`. The write counts as
 * done only when the answer is the state "returned_for_revision" with the same comment (B-6); any other answer is
 * unknown and the dialog keeps its state. The deadline is the UTC instant of the end of the chosen day in Zagreb.
 */

import { createApi, type ApiResult } from "./api";

type Api = ReturnType<typeof createApi>;
export type ReturnedForRevision = Extract<ApiResult<"work.return-for-revision.post">, { ok: true }>["body"];

export type ReturnResult =
  | { readonly kind: "returned"; readonly round: ReturnedForRevision }
  | { readonly kind: "session-expired" }
  | { readonly kind: "forbidden" }
  /** 409: the work is not in a state that can be returned (e.g. not submitted, or already returned). */
  | { readonly kind: "conflict" }
  /** 404, 408, 503, a broken connection, any other shape: the return may be recorded. */
  | { readonly kind: "nepoznato" };

/** Never throws. `dueAt` null sends no deadline. */
export async function returnWorkForRevision(
  documentId: string, comment: string, dueAt: string | null, api?: Api,
): Promise<ReturnResult> {
  try {
    const body = dueAt === null ? { comment } : { comment, revisionDueAt: dueAt };
    const result = await (api ?? createApi())("work.return-for-revision.post", { params: { documentId }, query: undefined, body });
    if (!result.ok) {
      if (result.status === 401) return { kind: "session-expired" };
      if (result.status === 403) return { kind: "forbidden" };
      return result.status === 409 ? { kind: "conflict" } : { kind: "nepoznato" };
    }
    return result.body.state === "returned_for_revision" && result.body.comment === comment
      ? { kind: "returned", round: result.body }
      : { kind: "nepoznato" };
  } catch {
    return { kind: "nepoznato" };
  }
}

/** The HTTP status a dialog `post` reads: 200 only for a confirmed return, null when nothing is known. */
export async function returnStatus(documentId: string, comment: string, dueAt: string | null, api?: Api): Promise<number | null> {
  const result = await returnWorkForRevision(documentId, comment, dueAt, api);
  switch (result.kind) {
    case "returned": return 200;
    case "session-expired": return 401;
    case "forbidden": return 403;
    case "conflict": return 409;
    default: return null;
  }
}
