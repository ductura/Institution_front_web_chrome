// Rules of the statement view (WEB-1503), kept apart from React so they are tested directly.
import {
  checkPrintout, type AnswerWrite, type HumanHelp, type HumanHelpKind, type StatementFile, type StatementPort, type StatementRead,
  type StatementWrite, type AttachmentLimits,
} from "../../../../../../src/client/statement.ts";
import { megabytes, statementMessages as text } from "./messages.hr";

/** Everything is read only once the work is submitted (the server states it, B-6). */
export function isReadOnly(read: StatementRead): boolean {
  return read.kind !== "ready" || read.submitted;
}

/** Error line for a refused printout, or null when it may be sent. */
export function printoutError(file: StatementFile, limits: AttachmentLimits): string | null {
  const check = checkPrintout(file, limits);
  switch (check.kind) {
    case "ok": return null;
    case "format": return text.errors.format.replace("{formats}", limits.allowedFormats.map((f) => f.extension).join(", "));
    case "tooLarge": return text.errors.tooLarge.replace("{size}", megabytes(limits.maxBytes));
    case "empty": return text.errors.empty;
  }
}

/** A help of "none" carries no text; any other kind needs a description. */
export function helpValid(help: HumanHelp): boolean {
  return help.kind === "none" ? help.text.trim() === "" : help.text.trim() !== "";
}

/** Changing the kind to "none" drops the description, which "none" may not carry. */
export function withKind(help: HumanHelp, kind: HumanHelpKind): HumanHelp {
  return { kind, text: kind === "none" ? "" : help.text };
}

/**
 * The fields after a read: an existing draft is kept (a refresh after an upload must not discard
 * unsaved edits); otherwise the saved help, or the first kind the server offers.
 */
export function helpAfterRead(draft: HumanHelp | null, read: StatementRead): HumanHelp | null {
  if (draft !== null || read.kind !== "ready") return draft;
  if (read.humanHelp) return read.humanHelp;
  const kind = read.helpKinds.includes("none") ? "none" : read.helpKinds[0];
  return kind === undefined ? null : { kind, text: "" };
}

/** Sends the help only when the view is open for writing and the input is valid. */
export async function saveHelp(port: StatementPort, id: string, read: StatementRead, help: HumanHelp): Promise<StatementWrite> {
  if (read.kind !== "ready" || isReadOnly(read) || !read.helpKinds.includes(help.kind) || !helpValid(help)) return { kind: "rejected" };
  try { return await port.saveHumanHelp(id, { kind: help.kind, text: help.text.trim() }); }
  catch { return { kind: "unavailable" }; }
}

/** Refuses a bad file before the port is called; a thrown port error is "unavailable". */
export async function attachFile(port: StatementPort, id: string, read: StatementRead, file: File): Promise<StatementWrite | { kind: "invalid"; message: string }> {
  if (read.kind !== "ready" || read.submitted) return { kind: "readOnly" };
  const message = printoutError(file, read.limits);
  if (message !== null) return { kind: "invalid", message };
  try { return await port.attachPrintout(id, file); }
  catch { return { kind: "unavailable" }; }
}

/** The line a write leaves: only `saved` reads as saved; every other answer stays as an alert. */
export function writeNotice(write: StatementWrite): { readonly tone: "status" | "alert"; readonly message: string } {
  switch (write.kind) {
    case "saved": return { tone: "status", message: text.saved };
    case "conflict": return { tone: "alert", message: text.conflict };
    case "rejected": case "readOnly": return { tone: "alert", message: text.rejected };
    default: return { tone: "alert", message: text.failed };
  }
}

// ---------------------------------------------------------------------------
// NF-3 PR-20: the answer to the teacher's question.

/** OD-4: the answer's limit in declaration-v1 (Unicode code points); the server checks it again. */
export const ANSWER_MAX_CHARS = 2000;

export type AnswerCheck =
  | { readonly kind: "ok"; readonly text: string }
  /** Nothing to keep: the answer is taken back (it is not obligatory). */
  | { readonly kind: "empty" }
  | { readonly kind: "tooLong" }
  | { readonly kind: "badCharacter" };

/** NFC, line feeds only, no leading or trailing space, within the limit, no other control character. */
export function checkAnswer(raw: string): AnswerCheck {
  const text = raw.replace(/\r\n?/g, "\n").normalize("NFC").trim();
  if (text === "") return { kind: "empty" };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(text)) return { kind: "badCharacter" };
  if ([...text].length > ANSWER_MAX_CHARS) return { kind: "tooLong" };
  return { kind: "ok", text };
}

/** The field after a read: an unsaved edit is kept; otherwise the held answer to the question asked now. */
export function answerAfterRead(draft: string | null, read: StatementRead): string | null {
  if (draft !== null || read.kind !== "ready" || read.question === null) return draft;
  return read.answer !== null && read.answer.questionId === read.question.questionId ? read.answer.text : "";
}

/**
 * Sends the answer (or takes it back) only while the view is open for writing and a question is
 * asked; a write the server cannot take is refused before the port is called.
 */
export async function saveAnswer(port: StatementPort, id: string, read: StatementRead, raw: string): Promise<StatementWrite | { kind: "invalid"; check: AnswerCheck }> {
  if (read.kind !== "ready" || isReadOnly(read) || read.question === null) return { kind: "readOnly" };
  const check = checkAnswer(raw);
  if (check.kind === "tooLong" || check.kind === "badCharacter") return { kind: "invalid", check };
  const answer: AnswerWrite = check.kind === "ok" ? { questionId: read.question.questionId, text: check.text } : null;
  try { return await port.saveAnswer(id, answer); }
  catch { return { kind: "unavailable" }; }
}
