// Pure rules of the teacher's submissions table and the read-only submitted version (WEB-1502;
// plan M7.2). The "after the deadline" tag is the server's `late` flag as it is: nothing here
// compares a time with a deadline. This module makes no network call; the page that mounts the
// screen passes the port (src/client/teacher-submissions.ts).
import type { SubmissionsRead, SubmittedRow, VersionRead } from "../../../../../../src/client/teacher-submissions.ts";
import { submissionsMessages as text } from "./messages.hr";

export type DocumentBlock = { readonly kind: "heading" | "paragraph" | "bulletItem" | "quote"; readonly text: string };
export type DocumentView = { readonly kind: "ready"; readonly blocks: readonly DocumentBlock[] } | { readonly kind: "unreadable" };

const KINDS: ReadonlySet<string> = new Set(["heading", "paragraph", "bulletItem", "quote"]);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The blocks of a submitted v1 or v2 document. Anything this view cannot show as it was submitted
 * (another schema version, an unknown block, a citation) makes the whole document unreadable
 * instead of being left out. TODO(ugovor): citations through editor-core's textBlocksOf once the
 * citation style of the assignment reaches the teacher's read.
 */
export function documentBlocks(document: string): DocumentView {
  let parsed: unknown;
  try {
    parsed = JSON.parse(document);
  } catch {
    return { kind: "unreadable" };
  }
  if (!isObject(parsed) || (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) || !Array.isArray(parsed.nodes)) {
    return { kind: "unreadable" };
  }
  const blocks: DocumentBlock[] = [];
  for (const node of parsed.nodes as unknown[]) {
    if (!isObject(node) || typeof node.type !== "string" || !KINDS.has(node.type) || !Array.isArray(node.children)) return { kind: "unreadable" };
    let joined = "";
    for (const child of node.children as unknown[]) {
      if (!isObject(child) || child.type !== "text" || typeof child.text !== "string") return { kind: "unreadable" };
      joined += child.text;
    }
    blocks.push({ kind: node.type as DocumentBlock["kind"], text: joined });
  }
  return { kind: "ready", blocks };
}

const MINUTE_FORMAT = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
});

/** The submission time in Zagreb time, or a dash when the server names none. */
export function submittedAt(row: SubmittedRow): string {
  return row.requestedMinute === null ? text.noTime : MINUTE_FORMAT.format(new Date(row.requestedMinute));
}

/** The tag of a row: only the recorded `late` flag decides it. */
export function lateTag(row: SubmittedRow): string | null {
  return row.late ? text.late : null;
}

/** The message of a read that is not ready. */
export function failureMessage(read: SubmissionsRead | VersionRead): string {
  switch (read.kind) {
    case "session-expired": return text.signedOut;
    case "greska": return text.notFound;
    default: return text.unavailable;
  }
}

/** Every submitted row opens: the detail is read by student, and the server records the opening. */
export function canOpen(row: SubmittedRow): boolean {
  return Number.isInteger(row.revision);
}

/** A read kept with the assignment it was made for. */
export type ForAssignment<T> = { readonly assignmentId: string } & T;
export type ListState = ForAssignment<{ readonly read: SubmissionsRead }> | null;
/** The open version panel: the row asked for and its read. */
export type VersionPanel = ForAssignment<{ readonly row: SubmittedRow; readonly read: VersionRead | "loading" }> | null;

/** Only what was read for the assignment shown now: another assignment's rows or version are never shown under it. */
export function forAssignment<T extends ForAssignment<object>>(state: T | null, assignmentId: string): T | null {
  return state !== null && state.assignmentId === assignmentId ? state : null;
}

/** The panel after a version read answers: an answer for a row no longer open (another opened, or closed) is dropped. */
export function answeredPanel(panel: VersionPanel, assignmentId: string, row: SubmittedRow, read: VersionRead): VersionPanel {
  return forAssignment(panel, assignmentId)?.row.studentId === row.studentId ? { assignmentId, row, read } : panel;
}
