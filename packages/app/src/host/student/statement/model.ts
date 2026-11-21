// Rules of the statement view (WEB-1503), kept apart from React so they are tested directly.
import {
  checkPrintout, type HumanHelp, type StatementFile, type StatementPort, type StatementRead,
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
