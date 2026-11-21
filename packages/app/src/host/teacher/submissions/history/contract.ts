// The teacher's history of submissions and withdrawals, and the switch in the assignment settings
// (WEB-1903; plan P-D3). TODO(ugovor): the routes are not in @ductura/contracts yet; the caller
// passes the transport and createApi answers "client_rejected", so the screen says "unavailable",
// never "no history". The switch changes only on the server's answer (B-6).
import { matchesSchema, type Schema } from "../../../../../../../src/client/schema-check";

export type HistoryCall = (
  id: "teacher.submission-history.get" | "teacher.assignment-withdrawal-setting.get" | "teacher.assignment-withdrawal-setting.post",
  input: { readonly params?: Readonly<Record<string, string>>; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type HistoryEvent = {
  readonly eventId: string;
  readonly studentId: string;
  readonly kind: "submitted" | "withdrawn";
  readonly revision: number;
  /** Minute of the record, `YYYY-MM-DDTHH:MM:00.000Z`. */
  readonly at: string;
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
const EVENT: Schema = closed({
  eventId: UUID,
  studentId: UUID,
  kind: { anyOf: [{ const: "submitted" }, { const: "withdrawn" }] },
  revision: { type: "integer", minimum: 1 },
  at: { type: "string", format: "date-time" },
});
const HISTORY: Schema = closed({ events: { type: "array", items: EVENT } });
const SETTING: Schema = closed({ enabled: { type: "boolean" } });

export async function readSubmissionHistory(call: HistoryCall, assignmentId: string): Promise<HistoryRead> {
  if (!matchesSchema(UUID, assignmentId)) return { kind: "greska", code: "not_found" };
  try {
    const result = await call("teacher.submission-history.get", { params: { assignmentId } });
    if (!result.ok) {
      if (result.status === 401) return { kind: "session-expired" };
      return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
    }
    if (result.status !== 200 || !matchesSchema(HISTORY, result.body)) return UNKNOWN;
    const { events } = result.body as { events: HistoryEvent[] };
    return new Set(events.map((e) => e.eventId)).size === events.length ? { kind: "ready", events } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

export async function readWithdrawalSetting(call: HistoryCall, assignmentId: string): Promise<SettingRead> {
  if (!matchesSchema(UUID, assignmentId)) return UNKNOWN;
  try {
    const result = await call("teacher.assignment-withdrawal-setting.get", { params: { assignmentId } });
    if (!result.ok) return result.status === 401 ? { kind: "session-expired" } : UNKNOWN;
    return result.status === 200 && matchesSchema(SETTING, result.body)
      ? { kind: "ready", enabled: (result.body as { enabled: boolean }).enabled }
      : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/** The answer must name the value that was asked for; anything else is not shown as saved. */
export async function saveWithdrawalSetting(call: HistoryCall, assignmentId: string, enabled: boolean): Promise<SettingOutcome> {
  if (!matchesSchema(UUID, assignmentId)) return { kind: "greska", code: "not_found" };
  try {
    const result = await call("teacher.assignment-withdrawal-setting.post", { body: { assignmentId, enabled } });
    if (result.ok) {
      if (result.status !== 200 || !matchesSchema(SETTING, result.body)) return UNKNOWN;
      return (result.body as { enabled: boolean }).enabled === enabled ? { kind: "spremljeno", enabled } : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 403) return { kind: "greska", code: "forbidden" };
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
