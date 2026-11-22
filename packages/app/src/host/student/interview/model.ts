// Rules of the student's interview page (WEB-1531), kept apart from React so they are tested directly.
import { interviewMessages as text } from "./messages.hr";
import { NOTE_FORMATS, NOTE_MAX_BYTES, type InterviewPort, type InterviewQuestion, type InterviewRead, type InterviewWrite } from "./port";

export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("hr-HR", { maximumFractionDigits: 1 })} MB`;
}

/** The student sees exactly the questions the teacher sees: general ones first, then by paragraph. */
export function orderedQuestions(questions: readonly InterviewQuestion[]): InterviewQuestion[] {
  return [...questions].sort((a, b) => Number(a.paragraphRef !== null) - Number(b.paragraphRef !== null));
}

export function explanationError(value: string): string | null {
  return value.trim() === "" ? text.errors.empty : null;
}

/** Error line for a refused note, or null when it may be sent. */
export function noteError(file: { name: string; size: number }): string | null {
  if (file.size === 0) return text.errors.fileEmpty;
  const lower = file.name.toLowerCase();
  if (!NOTE_FORMATS.some((ext) => lower.endsWith(ext)) || file.size > NOTE_MAX_BYTES) {
    return file.size > NOTE_MAX_BYTES ? text.errors.fileTooLarge.replace("{size}", megabytes(NOTE_MAX_BYTES)) : `Dopušteni formati: ${NOTE_FORMATS.join(", ")}.`;
  }
  return null;
}

export async function sendExplanation(port: InterviewPort, id: string, questionId: string | null, value: string): Promise<InterviewWrite> {
  if (explanationError(value) !== null) return { kind: "rejected" };
  try { return await port.explain(id, { questionId, text: value.trim() }); }
  catch { return { kind: "unavailable" }; }
}

export async function attachNote(port: InterviewPort, id: string, file: File): Promise<InterviewWrite | { kind: "invalid"; message: string }> {
  const message = noteError(file);
  if (message !== null) return { kind: "invalid", message };
  try { return await port.attachNote(id, file); }
  catch { return { kind: "unavailable" }; }
}

export function isInvited(read: InterviewRead): boolean { return read.kind === "ready"; }
