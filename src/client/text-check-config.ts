/**
 * The text check configuration read (WEB-1102, E§3.5 review2). The route has no
 * body: `GET /api/v1/student/assignments/{assignmentId}/text-check-config` answers
 * 200 `{enabledCheckIds, lektaProfileId}` and nothing else. The findings and the
 * work summary are made locally in the browser from the open document; the
 * server only says which checks the institution turned on for this assignment.
 *
 * The call goes through createApi, which holds a 200 to the closed schema. The
 * list is passed on with each id once; an id this build does not know is
 * dropped by the review module (`review/checks.ts`), not here.
 */

import { browserTransport, createApi, type ApiOptions, type ApiResult } from "./api";

export type TextCheckConfig = {
  /** Check ids the institution enabled, in the server's order, without duplicates. */
  readonly enabledCheckIds: readonly string[];
  /** Lekta profile of the assignment, or null when it has none. */
  readonly lektaProfileId: string | null;
};

export type TextCheckConfigOutcome =
  | { kind: "ok"; config: TextCheckConfig }
  | { kind: "signedOut" | "notFound" | "unavailable" };

type Body = Extract<ApiResult<"student.text-check-config.get">, { ok: true }>["body"];

/** The config of a 200 body: each id once, in order. */
export function configOf(body: Body): TextCheckConfig {
  return { enabledCheckIds: [...new Set(body.enabledCheckIds)], lektaProfileId: body.lektaProfileId };
}

/**
 * Asks for the configuration of `assignmentId`. `current()` is asked right
 * before the request: once the session has ended in this browser nothing is sent.
 */
export async function fetchTextCheckConfig(
  assignmentId: string,
  current: () => boolean = () => true,
  options: ApiOptions = {},
): Promise<TextCheckConfigOutcome> {
  if (!current()) return { kind: "signedOut" };
  const api = createApi({ fetchImpl: browserTransport, ...options });
  let result: ApiResult<"student.text-check-config.get">;
  try {
    result = await api("student.text-check-config.get", { params: { assignmentId }, query: undefined, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  if (!result.ok) {
    if (result.status === 401) return { kind: "signedOut" };
    return { kind: result.status === 404 ? "notFound" : "unavailable" };
  }
  return result.status === 200 ? { kind: "ok", config: configOf(result.body) } : { kind: "unavailable" };
}
