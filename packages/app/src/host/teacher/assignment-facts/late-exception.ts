// NZ-5 (variant B): an exception for a late submission of one student has its own record, written by
// `teacher.late-exception.post` and listed by `teacher.late-exceptions.get`. The draft is checked before it is sent; a
// record counts only when the server's answer (201) names the same student and deadline (B-6). The routes exist on
// the server and are only called here.
import type { createApi } from "../../../../../../src/client/api";
import type { Read } from "../../../../../../src/client/submission";
import { zagrebInstant } from "../../../../../../src/lib/i18n/zagreb";
import { assignmentFactsMessages as text } from "./messages.hr";
import { deadlineOf, type AssignmentReads, type FactRow } from "./model";

export const LATE_REASONS = ["justified", "technical", "agreement"] as const;
export type LateReason = (typeof LATE_REASONS)[number];

type Api = ReturnType<typeof createApi>;

/** One recorded exception; `reasonId` is null on a record another teacher wrote (the reason stays the author's). */
export type LateExceptionRecord = {
  readonly id: string;
  readonly studentId: string;
  readonly untilAt: string;
  readonly reasonId: LateReason | null;
  readonly createdBy: string;
  readonly createdAt: string;
};
export type LateExceptionDraft = { readonly studentId: string; readonly untilAt: string; readonly reasonId: LateReason };

export type LateOutcome =
  | { readonly kind: "zabiljezeno"; readonly exception: LateExceptionRecord }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  /** 408, 503, a broken connection, any other shape: the exception may be recorded. */
  | { readonly kind: "nepoznato" };

export type LateChoice = { readonly studentId: string; readonly reasonId: string; readonly dueLocal: string };

/** The draft to send, or the sentence that says what is missing. A deadline must lie after `now`. */
export function lateDraft(choice: LateChoice, now: number): { ok: true; draft: LateExceptionDraft } | { ok: false; error: string } {
  if (!(LATE_REASONS as readonly string[]).includes(choice.reasonId)) return { ok: false, error: text.late.needReason };
  const dueAt = zagrebInstant(choice.dueLocal);
  if (dueAt === null) return { ok: false, error: text.late.needDue };
  const ms = Date.parse(dueAt);
  if (!Number.isFinite(ms) || ms <= now) return { ok: false, error: text.late.dueNotLater };
  return { ok: true, draft: { studentId: choice.studentId, untilAt: new Date(ms).toISOString(), reasonId: choice.reasonId as LateReason } };
}

const UNKNOWN = { kind: "nepoznato" } as const;

function failure(status: number, code: string): Exclude<LateOutcome, { kind: "zabiljezeno" }> {
  if (status === 401) return { kind: "session-expired" };
  if (status === 404) return { kind: "greska", code: "not_found" };
  if (code === "client_rejected" || status === 400 || status === 413 || status === 415 || status === 422) return { kind: "greska", code: "invalid" };
  return UNKNOWN;
}

/** teacher.late-exception.post: a success only when the answer is this exception (B-6). */
export async function recordLateException(client: Api, assignmentId: string, draft: LateExceptionDraft): Promise<LateOutcome> {
  try {
    const result = await client("teacher.late-exception.post", { params: { assignmentId }, query: undefined, body: draft });
    if (!result.ok) return failure(result.status, result.code);
    const { exception } = result.body;
    if (result.status !== 201 || exception.studentId !== draft.studentId.toLowerCase() || exception.untilAt !== draft.untilAt) return UNKNOWN;
    return { kind: "zabiljezeno", exception };
  } catch {
    return UNKNOWN;
  }
}

/** teacher.late-exceptions.get: the exceptions of an assignment; a failed read is never an empty list. */
export async function readLateExceptions(client: Api, assignmentId: string): Promise<Read<{ kind: "ready"; exceptions: readonly LateExceptionRecord[] }>> {
  try {
    const result = await client("teacher.late-exceptions.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!result.ok) {
      const f = failure(result.status, result.code);
      return f.kind === "greska" && f.code === "invalid" ? UNKNOWN : f;
    }
    return { kind: "ready", exceptions: result.body.exceptions };
  } catch {
    return UNKNOWN;
  }
}

/**
 * The row gets "Dopusti predaju nakon roka…" when its student has no submission and that student's deadline (an
 * extension counts) has passed: "nije predano", and a work that was never opened ("nije započelo") after the deadline.
 */
export function offersLate(row: Pick<FactRow, "kind" | "studentId">, reads: Pick<AssignmentReads, "dueAt" | "extensions">, now: number = Date.now()): boolean {
  if (row.kind === "notSubmitted") return true;
  if (row.kind !== "notOpened") return false;
  const due = Date.parse(deadlineOf(row.studentId, reads.dueAt, reads.extensions).dueAt);
  return Number.isFinite(due) && now >= due;
}
