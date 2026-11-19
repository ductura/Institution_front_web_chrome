"use client";

import { DataTable, StateTag, type DataTableColumn } from "@ductura/ui";

import type { OverviewRow } from "@/client/teacher-reads";
import { formatDateTimeHr } from "@/lib/i18n/hr";
import { messagesHr } from "@/lib/i18n/messages.hr";

const t = messagesHr.teacherSummary;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * N-07 of one student's submission in one assignment (WEB-35), or null for
 * ids no route could read. The overview has no document or submission id
 * (SRV-27), so the receipt is keyed the way teacher.submission-receipt.get is.
 * TODO(N-07): the route of WEB-35 is not settled yet (Ductus#2028, PITANJE).
 */
export function submissionHref(assignmentId: string, studentId: string): string | null {
  if (!UUID.test(assignmentId) || !UUID.test(studentId)) return null;
  return `/nastavnik/zadatak/${assignmentId.toLowerCase()}/predaja/${studentId.toLowerCase()}`;
}

/** The UTC minute of the overview (`YYYY-MM-DDTHH:MMZ`) as an instant, or null. */
function instant(minute: string | null): Date | null {
  if (minute === null) return null;
  const at = new Date(minute);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** The state of the work: submitted or not, nothing else (no ranking, §5 rule 2). */
function state(row: OverviewRow) {
  return <StateTag state={row.submitted ? "submitted" : "not_submitted"} />;
}

/** The record as the receipt has it; a gap is a fact (rule 3), an unbound receipt waits. */
function record(row: OverviewRow) {
  if (!row.submitted) return t.none;
  if (row.evidenceRecord === "with_gaps") return <StateTag state="gap" />;
  if (row.evidenceRecord === "continuous") return t.recordContinuous;
  return <StateTag state="pending" />;
}

function student(assignmentId: string, row: OverviewRow) {
  const name = row.name ?? t.noName;
  const group = row.group === null ? t.noGroup : t.group.replace("{group}", row.group);
  const href = submissionHref(assignmentId, row.studentId);
  return (
    <>
      {href === null ? name : <a href={href}>{name}</a>}
      {` · ${group}`}
    </>
  );
}

export function overviewColumns(assignmentId: string): DataTableColumn<OverviewRow>[] {
  return [
    {
      id: "student", header: t.columns.student, rowHeader: true,
      cell: (row) => student(assignmentId, row),
      // A missing name sorts last instead of as its stand-in text.
      sortValue: (row) => row.name,
    },
    { id: "state", header: t.columns.state, cell: state },
    {
      id: "submittedAt", header: t.columns.submittedAt,
      cell: (row) => (row.requestedMinute === null ? t.none : (
        <time dateTime={row.requestedMinute}>{formatDateTimeHr(row.requestedMinute)}</time>
      )),
      sortValue: (row) => instant(row.requestedMinute),
    },
    {
      id: "afterDeadline", header: t.columns.afterDeadline,
      cell: (row) => (!row.submitted ? t.none : row.afterDeadline ? <StateTag state="late" /> : t.no),
    },
    { id: "record", header: t.columns.record, cell: record },
    // Wave 8 fills it ("Zatraži doradu"); until then the column is empty.
    { id: "revision", header: t.columns.revision, cell: () => null },
  ];
}

export type AssignmentOverviewProps = {
  assignmentId: string;
  assignmentTitle: string;
  rows: readonly OverviewRow[];
};

/**
 * N-17 (WEB-33): one assignment's submissions, a row per student, from
 * teacher.assignment-overview.get. No text, no hash and no submission id; the
 * overview opens no work, so it writes no access-log row (SRV-28). Sorting by
 * the submission time works from the keyboard through the DataTable header.
 */
export default function AssignmentOverview({ assignmentId, assignmentTitle, rows }: AssignmentOverviewProps) {
  return (
    <DataTable
      caption={t.caption.replace("{assignment}", assignmentTitle)}
      columns={overviewColumns(assignmentId)}
      rows={rows}
      rowKey={(row) => row.studentId}
      empty={t.noStudents}
    />
  );
}
