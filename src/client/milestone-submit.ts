/**
 * Student side of the milestones (WEB-1521, N-15).
 *
 * Reading uses `work.milestones.get` (in the generated extract). Sending a
 * milestone for review is SRV-1520 `POST .../milestones/{milestoneId}/submit`;
 * that operation is not in the web extract yet, so this module types it as a
 * port the caller injects. Nothing here calls the API directly. The write
 * counts as done only when the answer names the same milestone in the state
 * "submitted" (B-6); anything else is unknown and the screen keeps its state.
 */

import type { WorkMilestone } from "./work-milestones";

/** Server operation id assumed for SRV-1520 submit (not yet in the extract). */
export const SUBMIT_OPERATION = "work.milestones.submit";

/** Extract state plus the optional revision fields SRV-1520 adds. */
export type StudentMilestone = WorkMilestone & {
  readonly revisionComment?: string | null;
  readonly revisionDueAt?: string | null;
};

export type SubmitAnswer =
  | { readonly ok: true; readonly status: number; readonly body: unknown }
  | { readonly ok: false; readonly status: number; readonly code?: string };
/** The caller owns the transport: `(documentId, milestoneId) => answer`. */
export type SubmitPort = (documentId: string, milestoneId: string) => Promise<SubmitAnswer>;

export type SubmitResult =
  | { readonly kind: "saved"; readonly milestone: StudentMilestone }
  | { readonly kind: "session-expired" }
  /** 409: the milestone changed meanwhile; the list is read again. */
  | { readonly kind: "promijenjeno" }
  /** 408, 503, a broken connection, any other shape: the write may be recorded. */
  | { readonly kind: "nepoznato" };

/** A port for builds where the operation is not available yet: always unknown. */
export const unavailableSubmit: SubmitPort = async () => ({ ok: false, status: 503, code: "unavailable" });

/** The next milestone to show: the first one not yet approved, in list order. */
export function nextMilestone(list: readonly StudentMilestone[]): StudentMilestone | null {
  return list.find((item) => item.state !== "approved") ?? null;
}

/** The student may send only an open or returned milestone. */
export const maySubmit = (item: StudentMilestone): boolean => item.state === "open" || item.state === "returned";

/** Never throws. */
export async function submitMilestone(port: SubmitPort, documentId: string, milestoneId: string): Promise<SubmitResult> {
  try {
    const answer = await port(documentId, milestoneId);
    if (!answer.ok) {
      if (answer.status === 401) return { kind: "session-expired" };
      return answer.status === 409 ? { kind: "promijenjeno" } : { kind: "nepoznato" };
    }
    const body = answer.body as Partial<StudentMilestone> | null;
    if (body && typeof body === "object" && typeof body.id === "string"
      && body.id.toLowerCase() === milestoneId.toLowerCase() && body.state === "submitted") {
      return { kind: "saved", milestone: body as StudentMilestone };
    }
    return { kind: "nepoznato" };
  } catch {
    return { kind: "nepoznato" };
  }
}
