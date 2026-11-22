// Pure rules of N-13 "Produljenje roka" (WEB-2162; INVENTAR-nastavnik 3.13, PARITET N-13). The page reads the
// extensions, the students and (when it can) the task name, course and current deadline through a port in
// src/client; a part the read does not give is left out or said as unavailable, never guessed. No network call here.
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { EXTENSION_REASONS, type DeadlineExtension, type ExtensionDraft, type ExtensionStudent, type RecordOutcome } from "../../../../../../src/client/deadline-extensions";
import { n13Messages as text } from "./messages.hr";

export type N13Context = { readonly task: string | null; readonly course: string | null; readonly dueAt: string | null };

export type N13Data = {
  readonly context: N13Context;
  /** null: the list of extensions could not be read (shown as such, never as "none"). */
  readonly extensions: readonly DeadlineExtension[] | null;
  /** null: the students could not be read; only "all students" is then offered. */
  readonly students: readonly ExtensionStudent[] | null;
};

export type N13Read = { readonly kind: "ready"; readonly data: N13Data } | { readonly kind: "signedOut" } | { readonly kind: "unavailable" };

export interface N13Port {
  read(assignmentId: string): Promise<N13Read>;
  record(assignmentId: string, draft: ExtensionDraft): Promise<RecordOutcome>;
}

export const unavailablePort: N13Port = {
  read: async () => ({ kind: "unavailable" }),
  record: async () => ({ kind: "nepoznato" }),
};

export async function loadN13(port: N13Port, assignmentId: string): Promise<N13Read> {
  try {
    return await port.read(assignmentId);
  } catch {
    return { kind: "unavailable" };
  }
}

/** A failed record is "unknown", never a success (B-6). */
export async function recordN13(port: N13Port, assignmentId: string, draft: ExtensionDraft): Promise<RecordOutcome> {
  try {
    return await port.record(assignmentId, draft);
  } catch {
    return { kind: "nepoznato" };
  }
}

export function leadText(context: N13Context): string {
  return text.lead(context.task, context.course, context.dueAt === null ? null : formatDateTimeHr(context.dueAt));
}

export type Note = { readonly tone: "status" | "alert"; readonly bold: string; readonly rest: string | null };

/** What the page says after a record: a success only from the server's answer (B-6). */
export function noteOf(outcome: RecordOutcome, students: readonly ExtensionStudent[] | null): Note | null {
  switch (outcome.kind) {
    case "zabiljezeno": {
      if (!outcome.existingSubmissionsUnchanged) return { tone: "status", bold: text.recorded, rest: text.recordedRest };
      const id = outcome.extension.studentId;
      const who = id === null ? null : (students ?? []).find((s) => s.studentId === id)?.name ?? null;
      return { tone: "status", bold: text.conflict(who), rest: text.conflictRest };
    }
    case "greska":
      return { tone: "alert", bold: outcome.code === "not_found" ? text.notFound : text.invalid, rest: null };
    case "nepoznato":
      return { tone: "alert", bold: text.unknown, rest: null };
    default:
      return null;
  }
}

/** The reasons the form offers: "all" only for all students. */
export function reasonOptions(scope: "one" | "all") {
  return EXTENSION_REASONS.filter((r) => scope === "all" || r !== "all").map((r) => ({ value: r, label: text.reasons[r] }));
}

export function whoText(extension: DeadlineExtension, students: readonly ExtensionStudent[] | null): string {
  if (extension.studentId === null) return text.allStudents;
  return (students ?? []).find((s) => s.studentId === extension.studentId)?.name ?? text.unnamed;
}

/** "Stari rok …, razlog: …": the reason of another teacher stays hidden. */
export function detailText(extension: DeadlineExtension): string {
  const reason = extension.reasonId === null ? text.reasonHidden : text.reasons[extension.reasonId];
  const by = extension.reasonId === null ? text.byOther : text.byYou;
  return `${text.oldDue} ${formatDateTimeHr(extension.previousDueAt)} · ${text.reasonLabel}: ${reason} · ${text.recordedBy} ${by}, ${formatDateTimeHr(extension.createdAt)}`;
}

export function titleText(extension: DeadlineExtension, students: readonly ExtensionStudent[] | null): string {
  return `${whoText(extension, students)} · ${text.newDue} ${formatDateTimeHr(extension.dueAt)}`;
}
