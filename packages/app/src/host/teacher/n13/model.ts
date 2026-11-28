// Pure rules of N-13 "Produljenje roka" (WEB-2162; INVENTAR-nastavnik 3.13, PARITET N-13). The page reads the
// extensions, the students and (when it can) the task name, course and current deadline through a port in
// src/client; a part the read does not give is left out or said as unavailable, never guessed. No network call here.
import { momentHr as formatDateTimeHr } from "../n12/model";
import { EXTENSION_REASONS, type DeadlineExtension, type ExtensionDraft, type ExtensionStudent, type RecordOutcome } from "../../../../../../src/client/deadline-extensions";
import { n13Messages as text } from "./messages.hr";

export type N13Context = { readonly task: string | null; readonly course: string | null; readonly dueAt: string | null };

/** One student's recorded submission of the assignment (teacher.assignment-submissions.post); only those with `submitted`. */
export type ExtensionSubmission = { readonly studentId: string; readonly requestedMinute: string };

export type N13Data = {
  readonly context: N13Context;
  /** null: the list of extensions could not be read (shown as such, never as "none"). */
  readonly extensions: readonly DeadlineExtension[] | null;
  /** null: the students could not be read; only "all students" is then offered. */
  readonly students: readonly ExtensionStudent[] | null;
  /** null: the submissions could not be read; the page then says it cannot tell, never "nobody has submitted". */
  readonly submissions: readonly ExtensionSubmission[] | null;
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

/** "razlog: …, zabilježio …": the old deadline has its own column; the reason of another teacher stays hidden. */
export function detailText(extension: DeadlineExtension): string {
  const reason = extension.reasonId === null ? text.reasonHidden : text.reasons[extension.reasonId];
  const by = extension.reasonId === null ? text.byOther : text.byYou;
  return `${text.reasonLabel}: ${reason}, ${text.recordedBy} ${by}, ${formatDateTimeHr(extension.createdAt)}`;
}

export function titleText(extension: DeadlineExtension, students: readonly ExtensionStudent[] | null): string {
  return `${whoText(extension, students)}, ${text.newDue} ${formatDateTimeHr(extension.dueAt)}`;
}

/** NZ-2: whether the assignment's own deadline has passed; false when the read does not give it. */
export function deadlinePassed(context: N13Context, now: number): boolean {
  if (context.dueAt === null) return false;
  const ms = Date.parse(context.dueAt);
  return Number.isFinite(ms) && ms < now;
}

/** NZ-6: the extensions that apply to one student (their own and those for all); "" is every extension. */
export function filterByStudent(extensions: readonly DeadlineExtension[], studentId: string): readonly DeadlineExtension[] {
  if (studentId === "") return extensions;
  return extensions.filter((e) => e.scope === "all" || e.studentId === studentId);
}

/** NZ-6: what the student reads about this extension; the reason of another teacher is not ours to repeat. */
export function studentSeesText(extension: DeadlineExtension): string {
  const reason = extension.reasonId === null ? null : text.reasons[extension.reasonId];
  return text.studentSees(formatDateTimeHr(extension.previousDueAt), reason);
}

export type SubmissionWarning = { readonly tone: "status" | "alert"; readonly bold: string; readonly rest: string | null };

/**
 * NAS-R14 (NAS-26): before the extension is saved, what the teacher is told about submissions that already exist in the
 * scope, with the time each was requested. null when there is nothing to say (no student chosen yet, or nobody submitted).
 * Unreadable submissions are said as such (never "nobody has submitted").
 */
export function submissionWarning(
  scope: "one" | "all", studentId: string, students: readonly ExtensionStudent[] | null, submissions: readonly ExtensionSubmission[] | null,
): SubmissionWarning | null {
  if (scope === "one" && studentId === "") return null;
  if (submissions === null) return { tone: "status", bold: text.submissionsUnknown, rest: null };
  const nameOf = (id: string) => (students ?? []).find((s) => s.studentId === id)?.name ?? text.unnamed;
  if (scope === "one") {
    const found = submissions.find((s) => s.studentId === studentId);
    return found === undefined ? null : { tone: "status", bold: text.existingOne(nameOf(studentId), formatDateTimeHr(found.requestedMinute)), rest: text.existingRest };
  }
  if (submissions.length === 0) return null;
  const lines = submissions.map((s) => `${nameOf(s.studentId)} (${formatDateTimeHr(s.requestedMinute)})`).join(", ");
  return { tone: "status", bold: text.existingAll(submissions.length), rest: `${lines}. ${text.existingRest}` };
}
