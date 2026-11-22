// An in-memory server for the history and the withdrawal switch (WEB-1903), invented data. Tests only.
import type { HistoryCall, HistoryEvent } from "./contract";

export const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const STUDENT_A = "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d01";
const STUDENT_B = "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d02";
const ok = (body: unknown) => ({ ok: true as const, status: 200, body });

export const FAKE_EVENTS: readonly HistoryEvent[] = [
  { eventId: "00000000-0000-4000-8000-0000000000e1", studentId: STUDENT_A, kind: "submitted", revision: 7, at: "2026-12-01T09:00:00.000Z" },
  { eventId: "00000000-0000-4000-8000-0000000000e2", studentId: STUDENT_A, kind: "withdrawn", revision: 7, at: "2026-12-01T10:00:00.000Z" },
  { eventId: "00000000-0000-4000-8000-0000000000e3", studentId: STUDENT_B, kind: "submitted", revision: 3, at: "2026-12-01T10:00:00.000Z" },
];

export function fakeHistoryServer(events: readonly HistoryEvent[] = FAKE_EVENTS, opts: { enabled?: boolean; forbidSave?: boolean } = {}) {
  let enabled = opts.enabled ?? true;
  const call: HistoryCall = async (id, input) => {
    if (id === "teacher.submission-history.get") return ok({ events });
    if (id === "teacher.submission-withdrawal.get") return ok({ allowed: enabled, changedAt: null });
    if (opts.forbidSave === true) return { ok: false as const, status: 403, code: "forbidden" };
    enabled = (input.body as { allowed: boolean }).allowed;
    return ok({ allowed: enabled, changedAt: "2026-12-01T10:00:00.000Z" });
  };
  return { call, enabled: () => enabled };
}
