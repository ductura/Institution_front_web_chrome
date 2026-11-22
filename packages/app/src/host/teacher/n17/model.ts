// Pure rules of N-17 "Zbirni pregled" (WEB-2149; INVENTAR-nastavnik 3.6, PARITET N-17). One card per assignment,
// a meta line of counts and a six-column table. The server's overview says submitted or not; the states
// "u pisanju", "obavijest nije potvrđena", the extended deadline and the revision are optional fields:
// when the read does not give them they are shown as such ("nedostupno"), never guessed. No network call here.
import { compareHr } from "../../../../../editor-core/src/document/text/compare-hr";
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { n17Messages as text } from "./messages.hr";

export type Revision = { readonly state: "open" | "reopened" | "accepted" | "closed" };
export type N17Row = {
  readonly studentId: string;
  readonly name: string | null;
  readonly group: string | null;
  readonly submitted: boolean;
  /** UTC minute `YYYY-MM-DDTHH:MMZ`; only when submitted. */
  readonly requestedMinute: string | null;
  readonly afterDeadline: boolean;
  readonly evidenceRecord: "continuous" | "with_gaps" | null;
  readonly documentId?: string;
  /** Optional until the server says them. */
  readonly phase?: "writing" | "unconfirmed";
  readonly deadlineExtended?: boolean;
  /** Absent: the read does not say. `null`: no revision was requested. */
  readonly revision?: Revision | null;
};

export type N17Card = {
  readonly assignmentId: string;
  readonly title: string;
  readonly courseName: string;
  /** null: the read of this assignment failed. */
  readonly rows: readonly N17Row[] | null;
};

export type N17Read =
  | { readonly kind: "ready"; readonly cards: readonly N17Card[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export interface N17Port {
  read(): Promise<N17Read>;
}

export const unavailablePort: N17Port = { read: async () => ({ kind: "unavailable" }) };

/** Loads through the port; a failure is "unavailable", never an empty list. */
export async function loadN17(port: N17Port): Promise<N17Read> {
  try {
    return await port.read();
  } catch {
    return { kind: "unavailable" };
  }
}

export function stateText(row: N17Row): string {
  if (row.submitted) return text.state.submitted;
  if (row.phase === "writing") return row.deadlineExtended ? text.state.writingExtended : text.state.writing;
  if (row.phase === "unconfirmed") return text.state.unconfirmed;
  return text.state.notSubmitted;
}

export function timeText(row: N17Row): string {
  return row.submitted && row.requestedMinute !== null ? formatDateTimeHr(row.requestedMinute) : text.none;
}

export function afterDeadlineText(row: N17Row): string {
  return !row.submitted ? text.none : row.afterDeadline ? text.yes : text.no;
}

export function recordText(row: N17Row): string {
  if (!row.submitted) return text.none;
  if (row.evidenceRecord === "with_gaps") return text.recordGaps;
  return row.evidenceRecord === "continuous" ? text.recordContinuous : text.recordPending;
}

/** Text only, as D-128 O-3 asks; "nedostupno" when the read gives no revision field at all. */
export function revisionText(row: N17Row): string {
  if (row.revision === undefined) return text.revisionUnavailable;
  return row.revision === null ? text.revisionNone : text.revisionRequested(text.revisionStates[row.revision.state] ?? row.revision.state);
}

/** "predano 1 (od toga 1 nakon roka), u pisanju 2, …": zero counts are left out. */
export function summaryLine(rows: readonly N17Row[]): string {
  const submitted = rows.filter((r) => r.submitted);
  const count = (f: (r: N17Row) => boolean) => rows.filter((r) => !r.submitted && f(r)).length;
  const writing = count((r) => r.phase === "writing");
  const unconfirmed = count((r) => r.phase === "unconfirmed");
  const not = count((r) => r.phase === undefined);
  const parts: string[] = [];
  if (submitted.length > 0) parts.push(text.summary.submitted(submitted.length, submitted.filter((r) => r.afterDeadline).length));
  if (writing > 0) parts.push(text.summary.writing(writing));
  if (not > 0) parts.push(text.summary.notSubmitted(not));
  if (unconfirmed > 0) parts.push(text.summary.unconfirmed(unconfirmed));
  return parts.length === 0 ? text.summary.noRows : parts.join(", ");
}

const surname = (name: string): string => name.trim().split(/\s+/).slice(-1)[0] ?? name;

/** By surname, then name; no name last. Never by any figure. */
export function sortedRows(rows: readonly N17Row[]): readonly N17Row[] {
  return rows.slice().sort((a, b) => {
    if (a.name === null || b.name === null) return a.name === b.name ? 0 : a.name === null ? 1 : -1;
    return compareHr(surname(a.name), surname(b.name)) || compareHr(a.name, b.name);
  });
}

/** The live work of a row, only with a safe document id. */
export function workHref(row: N17Row): string | null {
  const id = row.documentId;
  return typeof id === "string" && /^[\w-]+$/.test(id) ? `/nastavnik/rad/${encodeURIComponent(id)}` : null;
}
