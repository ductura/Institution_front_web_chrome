// NF-3 PR-13, PR-15 (E-11b, E-11c; PO-38, PO-39): the student's own history of submissions and
// withdrawals, student.submission-history.get from the contract excerpt, checked against the
// contract's answer schema. A rejected call reads as "unavailable", never as "no history".
import migrationContracts from "../../../../../../../src/client/migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "../../../../../../../src/client/schema-check";
import type { SignedWithdrawalReceipt } from "../withdraw/contract";

export type HistoryCall = (
  id: "student.submission-history.get",
  input: { readonly params?: Readonly<Record<string, string>>; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

/** One entry of the history; a submission's receipt stays with the server, a withdrawal's can be saved. */
export type HistoryEvent =
  | { readonly kind: "submission"; readonly id: string; readonly attempt: number; readonly submissionId: string; readonly revision: number; readonly at: string; readonly afterDeadline: boolean }
  | { readonly kind: "withdrawal"; readonly id: string; readonly attempt: number; readonly submissionId: string; readonly revision: number; readonly at: string; readonly receipt: SignedWithdrawalReceipt | null };

export type StudentHistory = {
  /** False: the teacher or the faculty does not allow withdrawing for this assignment (PO-38). */
  readonly withdrawalAllowed: boolean;
  readonly dueAt: string;
  readonly events: readonly HistoryEvent[];
};

export type HistoryRead =
  | { readonly kind: "ready"; readonly history: StudentHistory }
  | { readonly kind: "session-expired" }
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HISTORY = migrationContracts["student.submission-history.get"].responses["200"].content["application/json"].schema as Schema;

type Raw = { kind: string; id: string; attempt: number; submissionId: string; revision: number; at: string; afterDeadline?: boolean; receipt?: unknown };

function toEvent(raw: Raw): HistoryEvent {
  const { id, attempt, submissionId, revision, at } = raw;
  return raw.kind === "submission"
    ? { kind: "submission", id, attempt, submissionId, revision, at, afterDeadline: raw.afterDeadline === true }
    : { kind: "withdrawal", id, attempt, submissionId, revision, at, receipt: (raw.receipt ?? null) as SignedWithdrawalReceipt | null };
}

export async function readStudentHistory(call: HistoryCall, assignmentId: string): Promise<HistoryRead> {
  if (!UUID.test(assignmentId)) return UNKNOWN;
  try {
    const result = await call("student.submission-history.get", { params: { assignmentId } });
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    if (result.status !== 200 || !matchesSchema(HISTORY, result.body)) return UNKNOWN;
    const body = result.body as { withdrawalAllowed: boolean; dueAt: string; events: Raw[] };
    const events = body.events.map(toEvent);
    if (new Set(events.map((e) => e.id)).size !== events.length) return UNKNOWN;
    return { kind: "ready", history: { withdrawalAllowed: body.withdrawalAllowed, dueAt: body.dueAt, events } };
  } catch {
    return UNKNOWN;
  }
}
