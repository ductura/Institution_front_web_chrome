// Rules of the student's interview page (WEB-1531), kept apart from React so they are tested directly.
import { interviewMessages as text } from "./messages.hr";
import {
  EXPLANATION_MAX_CHARS, NOTE_FORMATS, NOTE_MAX_BYTES, NOTE_MEDIA_TYPES, NOTE_NAME_MAX_CHARS,
  type InterviewPort, type InterviewQuestion, type InterviewRead, type InterviewWrite,
} from "./port";

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

type Ready = Extract<InterviewRead, { kind: "ready" }>;

/** The note's format by its extension, or null for one the route does not take. */
function formatOf(name: string): (typeof NOTE_FORMATS)[number] | null {
  const lower = name.toLowerCase();
  return NOTE_FORMATS.find((ext) => lower.endsWith(ext)) ?? null;
}

/** A name the route takes (fileName): no surrounding space, no control character, no path separator. */
const NOTE_NAME = /^(?!\s)[^\u0000-\u001f\u007f-\u009f/\\]+(?<!\s)$/u;

/** Error line for a refused note, or null when it may be sent. Checked before anything is sent. */
export function noteError(file: { name: string; size: number }): string | null {
  if (file.size === 0) return text.errors.fileEmpty;
  if (file.size > NOTE_MAX_BYTES) return text.errors.fileTooLarge.replace("{size}", megabytes(NOTE_MAX_BYTES));
  if (formatOf(file.name) === null) return text.errors.fileType;
  if (file.name.length > NOTE_NAME_MAX_CHARS || !NOTE_NAME.test(file.name)) return text.errors.fileName;
  return null;
}

/** The content must be what the extension says: a PDF starts with %PDF-, a text is valid UTF-8. */
export function noteContentError(name: string, bytes: Uint8Array): string | null {
  if (formatOf(name) === ".pdf") {
    return [...bytes.subarray(0, 5)].map((b) => String.fromCharCode(b)).join("") === "%PDF-" ? null : text.errors.fileType;
  }
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return null; }
  catch { return text.errors.fileEncoding; }
}

export async function sendExplanation(port: InterviewPort, id: string, questionId: string | null, value: string): Promise<InterviewWrite> {
  if (explanationError(value) !== null) return { kind: "rejected" };
  try { return await port.explain(id, { questionId, text: value.trim() }); }
  catch { return { kind: "unavailable" }; }
}

/** A refused type, size or name never reaches the port; the server's answer is passed on as it is. */
export async function attachNote(port: InterviewPort, id: string, file: File): Promise<InterviewWrite | { kind: "invalid"; message: string }> {
  const message = noteError(file);
  if (message !== null) return { kind: "invalid", message };
  const format = formatOf(file.name);
  if (port.attachNote === undefined || format === null) return { kind: "unavailable" };
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(await file.arrayBuffer()); }
  catch { return { kind: "unavailable" }; }
  const content = noteContentError(file.name, bytes);
  if (content !== null) return { kind: "invalid", message: content };
  try { return await port.attachNote(id, { fileName: file.name, mediaType: NOTE_MEDIA_TYPES[format], bytes }); }
  catch { return { kind: "unavailable" }; }
}

/** The note action is offered only to an invited student before the talk is held. */
export function notesOpen(read: Ready, port: InterviewPort): boolean {
  return port.attachNote !== undefined && read.heldAt === null;
}

/** The page after a note: listed as saved only with the server's confirmation; 409 closes the action. */
export function afterNote(read: Ready, result: InterviewWrite): { readonly read: Ready; readonly closed: boolean; readonly saved: boolean; readonly message: string } {
  if (result.kind === "closed") return { read, closed: true, saved: false, message: text.noteClosed };
  const note = result.kind === "saved" ? result.note : undefined;
  if (note === undefined) return { read, closed: false, saved: false, message: result.kind === "rejected" ? text.noteRejected : text.noteFailed };
  const known = read.attachments.some((n) => n.id === note.id);
  return { read: known ? read : { ...read, attachments: [...read.attachments, note] }, closed: false, saved: true, message: text.noteSaved };
}

/** work.interview.get does not list notes: a new read keeps the notes the server confirmed in this session. */
export function keepNotes(previous: InterviewRead | null, next: InterviewRead): InterviewRead {
  if (previous?.kind !== "ready" || next.kind !== "ready") return next;
  const extra = previous.attachments.filter((n) => !next.attachments.some((m) => m.id === n.id));
  return extra.length === 0 ? next : { ...next, attachments: [...next.attachments, ...extra] };
}

export function isInvited(read: InterviewRead): boolean { return read.kind === "ready"; }

/**
 * The page after a send: an explanation counts as sent only with the server's confirmation, and then it is
 * the server's copy that is listed. Any other answer leaves the read as it was and keeps the draft.
 */
export function afterSend(read: Ready, result: InterviewWrite): {
  readonly read: Ready; readonly sent: boolean; readonly message: string;
} {
  if (result.kind !== "saved") return { read, sent: false, message: result.kind === "rejected" ? text.rejected : text.failed };
  const explanation = result.explanation;
  const known = explanation === undefined || read.explanations.some((e) => e.id === explanation.id);
  return { read: known ? read : { ...read, explanations: [...read.explanations, explanation] }, sent: true, message: text.sent };
}
