// Rules of the statement view (WEB-1503), kept apart from React so they are tested directly.
import {
  checkPrintout, TOOL_FIELD_MAX, TOOLS_MAX, type AnswerWrite, type DeclaredTool, type HumanHelp, type HumanHelpKind, type StatementFile,
  type StatementPort, type StatementRead, type StatementWrite, type AttachmentLimits,
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
// ED-12 (NF2-P12): the tools outside Ductura (alat, svrha, faza).

const field = (raw: string) => raw.replace(/\s+/g, " ").normalize("NFC").trim();

/** A row is complete with all three fields, each within the limit; a row left wholly empty is dropped. */
export type ToolsCheck = { readonly kind: "ok"; readonly tools: readonly DeclaredTool[] } | { readonly kind: "incomplete" | "tooLong" | "tooMany" };

export function checkTools(rows: readonly DeclaredTool[]): ToolsCheck {
  const tools = rows.map((r) => ({ tool: field(r.tool), purpose: field(r.purpose), phase: field(r.phase) }))
    .filter((r) => r.tool !== "" || r.purpose !== "" || r.phase !== "");
  if (tools.length > TOOLS_MAX) return { kind: "tooMany" };
  if (tools.some((r) => r.tool === "" || r.purpose === "" || r.phase === "")) return { kind: "incomplete" };
  if (tools.some((r) => [r.tool, r.purpose, r.phase].some((v) => [...v].length > TOOL_FIELD_MAX))) return { kind: "tooLong" };
  return { kind: "ok", tools };
}

/** The rows after a read: unsaved edits are kept; otherwise the declared tools, or none. */
export function toolsAfterRead(draft: readonly DeclaredTool[] | null, read: StatementRead): readonly DeclaredTool[] | null {
  if (draft !== null || read.kind !== "ready") return draft;
  return read.tools ?? [];
}

/** Sends the list only while the view is open for writing, the port keeps tools and every row is complete. */
export async function saveTools(port: StatementPort, id: string, read: StatementRead, rows: readonly DeclaredTool[]): Promise<StatementWrite | { kind: "invalid"; check: ToolsCheck }> {
  if (read.kind !== "ready" || isReadOnly(read) || port.saveTools === undefined) return { kind: "readOnly" };
  const check = checkTools(rows);
  if (check.kind !== "ok") return { kind: "invalid", check };
  try { return await port.saveTools(id, check.tools); }
  catch { return { kind: "unavailable" }; }
}

/** The alert under the list for a list the server would not take, or null. */
export function toolsError(check: ToolsCheck): string | null {
  switch (check.kind) {
    case "ok": return null;
    case "incomplete": return text.tools.incomplete;
    case "tooLong": return text.tools.tooLong.replace("{max}", String(TOOL_FIELD_MAX));
    case "tooMany": return text.tools.tooMany.replace("{max}", String(TOOLS_MAX));
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
