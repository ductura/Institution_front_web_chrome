// Rules of the student's interview page (WEB-1531), kept apart from React so they are tested directly.
import { interviewMessages as text } from "./messages.hr";
import { EXPLANATION_MAX_CHARS, NOTE_FORMATS, NOTE_MAX_BYTES, NOTE_NAME_MAX, type InterviewPort, type InterviewQuestion, type InterviewRead, type InterviewWrite } from "./port";

export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("hr-HR", { maximumFractionDigits: 1 })} MB`;
}

/** The student sees exactly the questions the teacher sees: general ones first, then by paragraph. */
export function orderedQuestions(questions: readonly InterviewQuestion[]): InterviewQuestion[] {
  return [...questions].sort((a, b) => Number(a.paragraphRef !== null) - Number(b.paragraphRef !== null));
}

export function explanationError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return text.errors.empty;
  return trimmed.length > EXPLANATION_MAX_CHARS ? text.errors.tooLong.replace("{max}", String(EXPLANATION_MAX_CHARS)) : null;
}

/** A date and time of the server (ISO) or a day (YYYY-MM-DD) as the page shows it. */
export function shownDate(value: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(day ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("hr-HR", day ? { dateStyle: "long", timeZone: "Europe/Zagreb" } : { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Zagreb" });
}

/** Error line for a refused note, or null when it may be sent. */
export function noteError(file: { name: string; size: number }): string | null {
  if (file.size === 0) return text.errors.fileEmpty;
  const name = file.name.trim();
  const lower = name.toLowerCase();
  if (!NOTE_FORMATS.some((ext) => lower.endsWith(ext)) || file.size > NOTE_MAX_BYTES) {
    return file.size > NOTE_MAX_BYTES ? text.errors.fileTooLarge.replace("{size}", megabytes(NOTE_MAX_BYTES)) : text.errors.fileType.replace("{formats}", NOTE_FORMATS.join(", "));
  }
  return name.length > NOTE_NAME_MAX ? text.errors.fileName.replace("{max}", String(NOTE_NAME_MAX)) : null;
}

export async function sendExplanation(port: InterviewPort, id: string, questionId: string | null, value: string): Promise<InterviewWrite> {
  if (explanationError(value) !== null) return { kind: "rejected" };
  try { return await port.explain(id, { questionId, text: value.trim() }); }
  catch { return { kind: "unavailable" }; }
}

export async function attachNote(port: InterviewPort, id: string, file: File): Promise<InterviewWrite | { kind: "invalid"; message: string }> {
  const message = noteError(file);
  if (message !== null) return { kind: "invalid", message };
  if (port.attachNote === undefined) return { kind: "unavailable" };
  try { return await port.attachNote(id, file); }
  catch { return { kind: "unavailable" }; }
}

/** The note action is offered only to an invited student before the interview is held. */
export function canAttach(read: InterviewRead): boolean { return read.kind === "ready" && read.heldAt === null; }

/**
 * The page after a note: it is listed only with the server's confirmation, under the server's name.
 * A held interview (409) ends the action; any other answer leaves the list as it was.
 */
export function afterAttach(read: Extract<InterviewRead, { kind: "ready" }>, result: InterviewWrite): {
  readonly read: Extract<InterviewRead, { kind: "ready" }>; readonly message: string; readonly saved: boolean;
} {
  if (result.kind === "saved") {
    const name = result.note;
    const listed = name === undefined || read.attachments.includes(name) ? read : { ...read, attachments: [...read.attachments, name] };
    return { read: listed, message: text.noteSaved, saved: true };
  }
  if (result.kind === "held") return { read, message: text.noteHeld, saved: false };
  return { read, message: result.kind === "rejected" ? text.noteRejected : text.noteFailed, saved: false };
}

export function isInvited(read: InterviewRead): boolean { return read.kind === "ready"; }

/**
 * The page after a send: an explanation counts as sent only with the server's confirmation, and then it is
 * the server's copy that is listed. Any other answer leaves the read as it was and keeps the draft.
 */
export function afterSend(read: Extract<InterviewRead, { kind: "ready" }>, result: InterviewWrite): {
  readonly read: Extract<InterviewRead, { kind: "ready" }>; readonly sent: boolean; readonly message: string;
} {
  if (result.kind !== "saved") return { read, sent: false, message: result.kind === "rejected" ? text.rejected : text.failed };
  const explanation = result.explanation;
  const known = explanation === undefined || read.explanations.some((e) => e.id === explanation.id);
  return { read: known ? read : { ...read, explanations: [...read.explanations, explanation] }, sent: true, message: text.sent };
}
