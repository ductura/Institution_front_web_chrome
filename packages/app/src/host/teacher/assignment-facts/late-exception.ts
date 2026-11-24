// NZ-5 (variant A): the draft of an exception for one student, checked before it is sent. The send itself is
// `recordDeadlineExtension` of the shared client; a record counts only when the server's answer names the same
// student and deadline (B-6).
import type { ExtensionDraft } from "../../../../../../src/client/deadline-extensions";
import { zagrebInstant } from "../../../../../../src/lib/i18n/zagreb";
import { assignmentFactsMessages as text } from "./messages.hr";

export const LATE_REASONS = ["justified", "technical", "agreement"] as const;
export type LateReason = (typeof LATE_REASONS)[number];

export type LateChoice = { readonly studentId: string; readonly reasonId: string; readonly dueLocal: string };

/** The draft to send, or the sentence that says what is missing. A deadline must lie after `now`. */
export function lateDraft(choice: LateChoice, now: number): { ok: true; draft: ExtensionDraft } | { ok: false; error: string } {
  if (!(LATE_REASONS as readonly string[]).includes(choice.reasonId)) return { ok: false, error: text.late.needReason };
  const dueAt = zagrebInstant(choice.dueLocal);
  if (dueAt === null) return { ok: false, error: text.late.needDue };
  const ms = Date.parse(dueAt);
  if (!Number.isFinite(ms) || ms <= now) return { ok: false, error: text.late.dueNotLater };
  return { ok: true, draft: { scope: "one", studentId: choice.studentId, dueAt: new Date(ms).toISOString(), reasonId: choice.reasonId } };
}
