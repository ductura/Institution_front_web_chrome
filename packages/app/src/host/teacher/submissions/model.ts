import type { OverviewRow } from "../../../../../../src/client/teacher-reads";
import type { SubmissionRow } from "../../../../../../src/client/teacher-submissions";

/** A row of the table: the contract's row plus the name and group of the overview, when it could be read. */
export type TableRow = {
  readonly studentId: string;
  readonly name: string | null;
  readonly group: string | null;
  readonly documentId: string | null;
  readonly submitted: boolean;
  readonly revision: number | null;
  readonly requestedMinute: string | null;
  /** `afterDeadline` of the server, never computed here. */
  readonly late: boolean | null;
};

/** Names and groups come from the overview of the same assignment; without it they stay `null`, never a stand-in. */
export function buildRows(submissions: readonly SubmissionRow[], overview: readonly OverviewRow[] | null): TableRow[] {
  const people = new Map((overview ?? []).map((r) => [r.studentId, r]));
  return submissions.map((s) => ({
    studentId: s.studentId,
    name: people.get(s.studentId)?.name ?? null,
    group: people.get(s.studentId)?.group ?? null,
    documentId: s.documentId,
    submitted: s.submitted,
    revision: s.revision,
    requestedMinute: s.requestedMinute,
    late: s.afterDeadline,
  }));
}

const SAFE_ID = (id: string) => id !== "" && id !== "." && id !== ".." && id.trim() === id && !/\p{Cc}/u.test(id);

/** The read-only page of one submitted work (N-07); null for a row without a submitted work. */
export function viewHref(row: TableRow): string | null {
  if (!row.submitted || row.documentId === null || !SAFE_ID(row.documentId)) return null;
  return `/nastavnik/rad/${encodeURIComponent(row.documentId)}/predaja`;
}
