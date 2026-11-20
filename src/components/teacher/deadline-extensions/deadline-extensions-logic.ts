// The pure parts of the N-13 form (WEB-1113): what the page says after the server's answer.
import type { CreateOutcome, ExtensionInput } from "../../../client/deadline-extensions.ts";
import { messagesHr } from "../../../lib/i18n/messages.hr.ts";

const t = messagesHr.deadlineExtensions;

/** A student of the assignment as the form lists it; `submitted` is true once a submission was received. */
export type ExtensionStudent = { readonly studentId: string; readonly name: string | null; readonly submitted: boolean };

export type ExtensionNote = { readonly tone: "status" | "alert"; readonly text: string; readonly recorded: boolean };

/** True when a submission was received from a student the extension covers. */
export function coversReceivedSubmission(input: ExtensionInput, students: readonly ExtensionStudent[]): boolean {
  return input.scope === "all"
    ? students.some((s) => s.submitted)
    : students.some((s) => s.studentId === input.studentId && s.submitted);
}

/**
 * The note for an outcome. A success only from a recorded answer (B-6); a
 * received submission is named as left unchanged, and a server that says it
 * changed is an alert, never a success.
 */
export function extensionNote(outcome: CreateOutcome, input: ExtensionInput, students: readonly ExtensionStudent[]): ExtensionNote | null {
  switch (outcome.kind) {
    case "zabiljezeno": {
      if (!outcome.existingSubmissionsUnchanged) return { tone: "alert", text: t.submissionChanged, recorded: true };
      const base = input.scope === "all" ? t.recordedAll : t.recordedNote;
      const received = coversReceivedSubmission(input, students);
      return { tone: "status", text: received ? `${base} ${t.submissionReceived}` : `${base} ${t.unchanged}`, recorded: true };
    }
    case "greska":
      return { tone: "alert", text: outcome.code === "not_found" ? t.notFound : t.invalid, recorded: false };
    case "nepoznato":
      return { tone: "alert", text: t.unknown, recorded: false };
    default:
      return null;
  }
}

/** The extensions newest first, and one recorded in this session not twice. */
export function withRecorded<T extends { readonly extensionId: string; readonly recordedAt: string }>(list: readonly T[], added: T | null): T[] {
  const all = added === null || list.some((e) => e.extensionId === added.extensionId) ? [...list] : [...list, added];
  return all.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
}
