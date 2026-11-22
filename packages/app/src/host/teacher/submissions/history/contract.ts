// The teacher's history of submissions and withdrawals, and the switch in the assignment settings
// (WEB-1903; plan P-D3). WEB-2003: the switch uses the server's operations
// teacher.submission-withdrawal.get and .post (contract excerpt). LOK-WEB-21: the history read is
// teacher.submission-history.get for one student, checked against the contract's own answer schema;
// a rejected call reads as "unavailable", never "no history". The switch changes only on the
// server's answer (B-6).
import migrationContracts from "../../../../../../../src/client/migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "../../../../../../../src/client/schema-check";

export type HistoryCall = (
  id: "teacher.submission-history.get" | "teacher.submission-withdrawal.get" | "teacher.submission-withdrawal.post",
  input: { readonly params?: Readonly<Record<string, string>>; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

/** One entry of the server's history; receipts stay with the server's evidence, not on screen. */
export type HistoryEvent = {
  readonly kind: "submission" | "withdrawal";
  readonly id: string;
  readonly attempt: number;
  readonly submissionId: string;
  readonly revision: number;
  /** Record time, `YYYY-MM-DDTHH:MM:SS.sssZ`. */
  readonly at: string;
  /** Present on a submission only. */
  readonly afterDeadline?: boolean;
};

export type HistoryRead =
  | { readonly kind: "ready"; readonly events: readonly HistoryEvent[] }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" }
  | { readonly kind: "nepoznato" };

export type SettingRead =
  | { readonly kind: "ready"; readonly enabled: boolean }
  | { readonly kind: "session-expired" }
  | { readonly kind: "nepoznato" };

export type SettingOutcome =
  | { readonly kind: "spremljeno"; readonly enabled: boolean }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "forbidden" }
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID: Schema = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" };
const closed = (properties: Record<string, Schema>): Schema =>
  ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const HISTORY = migrationContracts["teacher.submission-history.get"].responses["200"].content["application/json"].schema as Schema;
const SETTING: Schema = closed({ allowed: { type: "boolean" }, changedAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] } });

export async function readSubmissionHistory(call: HistoryCall, assignmentId: string, studentId: string): Promise<HistoryRead> {
  if (!matchesSchema(UUID, assignmentId) || !matchesSchema(UUID, studentId)) return { kind: "greska", code: "not_found" };
  try {
    const result = await call("teacher.submission-history.get", { params: { assignmentId, studentId } });
    if (!result.ok) {
      if (result.status === 401) return { kind: "session-expired" };
      return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
    }
    if (result.status !== 200 || !matchesSchema(HISTORY, result.body)) return UNKNOWN;
    const events = (result.body as { events: (HistoryEvent & { receipt: unknown })[] }).events.map(toEvent);
    return new Set(events.map((e) => e.id)).size === events.length ? { kind: "ready", events } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

function toEvent({ kind, id, attempt, submissionId, revision, at, afterDeadline }: HistoryEvent): HistoryEvent {
  const base = { kind, id, attempt, submissionId, revision, at };
  return kind === "submission" ? { ...base, afterDeadline } : base;
}

export async function readWithdrawalSetting(call: HistoryCall, assignmentId: string): Promise<SettingRead> {
  if (!matchesSchema(UUID, assignmentId)) return UNKNOWN;
  try {
    const result = await call("teacher.submission-withdrawal.get", { params: { assignmentId } });
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    return result.status === 200 && matchesSchema(SETTING, result.body)
      ? { kind: "ready", enabled: (result.body as { allowed: boolean }).allowed }
      : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** The answer must name the value that was asked for; anything else is not shown as saved. */
export async function saveWithdrawalSetting(call: HistoryCall, assignmentId: string, enabled: boolean): Promise<SettingOutcome> {
  if (!matchesSchema(UUID, assignmentId)) return { kind: "greska", code: "not_found" };
  try {
    const result = await call("teacher.submission-withdrawal.post", { params: { assignmentId }, body: { allowed: enabled } });
    if (result.ok) {
      if (result.status !== 200 || !matchesSchema(SETTING, result.body)) return UNKNOWN;
      return (result.body as { allowed: boolean }).allowed === enabled ? { kind: "spremljeno", enabled } : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 403) return { kind: "greska", code: "forbidden" };
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
