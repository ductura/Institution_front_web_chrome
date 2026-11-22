/**
 * Student side of the milestones (WEB-1521, N-15).
 *
 * Reading uses `work.milestone-states.get` (state, submittedAt, revision
 * comment and deadline); sending uses `work.milestones.submit.post`. Both are
 * in the generated extract and go only through `createApi`. The write counts
 * as done only when the answer names the same milestone in the state
 * "submitted" (B-6); anything else is unknown and the screen keeps its state.
 */

import { createApi, type ApiResult } from "./api";

type Milestones = Extract<ApiResult<"work.milestone-states.get">, { ok: true }>["body"]["milestones"];
export type StudentMilestone = Milestones[number];

export async function readStudentMilestones(documentId: string, api = createApi()) {
  return api("work.milestone-states.get", { params: { documentId }, query: undefined, body: undefined });
}

export type SubmitResult =
  | { readonly kind: "saved"; readonly milestone: StudentMilestone }
  | { readonly kind: "session-expired" }
  /** 409: the milestone changed meanwhile; the list is read again. */
  | { readonly kind: "promijenjeno" }
  /** 408, 503, a broken connection, any other shape: the write may be recorded. */
  | { readonly kind: "nepoznato" };

/** The next milestone to show: the first one not yet approved, in list order. */
export function nextMilestone(list: readonly StudentMilestone[]): StudentMilestone | null {
  return list.find((item) => item.state !== "approved") ?? null;
}

/** The student may send only a not yet sent milestone or one returned for revision. */
export const maySubmit = (item: StudentMilestone): boolean =>
  item.state === "not_submitted" || item.state === "revision_requested";

/** Never throws. */
export async function submitMilestone(documentId: string, milestoneId: string, api = createApi()): Promise<SubmitResult> {
  try {
    const result = await api("work.milestones.submit.post", { params: { documentId, milestoneId }, query: undefined, body: undefined });
    if (!result.ok) {
      if (result.status === 401) return { kind: "session-expired" };
      return result.status === 409 ? { kind: "promijenjeno" } : { kind: "nepoznato" };
    }
    const body = result.body;
    if (body.id.toLowerCase() === milestoneId.toLowerCase() && body.state === "submitted") {
      return { kind: "saved", milestone: body };
    }
    return { kind: "nepoznato" };
  } catch {
    return { kind: "nepoznato" };
  }
}
