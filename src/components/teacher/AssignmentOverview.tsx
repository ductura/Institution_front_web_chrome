"use client";

import { DataTable, StateTag, type DataTableColumn } from "@ductura/ui";

import type { OverviewRow } from "../../client/teacher-reads";
import { formatDateTimeHr } from "../../lib/i18n/hr";
import { messagesHr } from "../../lib/i18n/messages.hr";
import LoadAlert from "../shell/LoadAlert";

import styles from "./AssignmentOverview.module.css";

const t = messagesHr.teacherSummary;

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

/**
 * TODO(ugovor): SRV-27 will give every row a `documentId` (orchestrator,
 * Ductus#2028); OverviewRow in src/client (W-A) does not carry it yet, so it is
 * optional here and a row without it has no link.
 */
export type OverviewRowWork = OverviewRow & { readonly documentId?: string };

/** N-07 (WEB-35): the teacher's page for one submitted work; null without a document id. */
export function submissionHref(row: OverviewRowWork): string | null {
  const id = row.documentId;
  if (id === undefined || id === "" || id === "." || id === ".." || id.trim() !== id || /\p{Cc}/u.test(id)) return null;
  return `/nastavnik/rad/${encodeURIComponent(id)}/predaja`;
}

/** The student and the group; a submitted row with a document id leads to N-07. */
function student(row: OverviewRowWork) {
  const group = row.group === null ? t.noGroup : t.group.replace("{group}", row.group);
  const label = (
    <span className={styles.who}>
      <span>{row.name ?? t.noName}</span>
      <span>{group}</span>
    </span>
  );
  const href = row.submitted ? submissionHref(row) : null;
  return href === null ? label : <a href={href}>{label}</a>;
}

export const OVERVIEW_COLUMNS: readonly DataTableColumn<OverviewRowWork>[] = [
  // A missing name sorts last instead of as its stand-in text.
  { id: "student", header: t.columns.student, rowHeader: true, cell: student, sortValue: (row) => row.name },
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
  // Design alignment 27. 11. 2026.: the "revision" column (t.columns.revision) stays
  // hidden until wave 8 brings its data ("Zatraži doradu").
];

export type AssignmentOverviewProps = {
  assignmentTitle: string;
  /** The rows of teacher.assignment-overview.get; null when the read failed. */
  rows: readonly OverviewRowWork[] | null;
  loading?: boolean;
  /** Where "Pokušaj ponovno" leads when the read failed. */
  retryHref?: string;
};

/**
 * N-17 (WEB-33): one assignment's submissions, a row per student, from
 * teacher.assignment-overview.get. No text, no hash and no submission id; the
 * overview opens no work, so it writes no access-log row (SRV-28). Sorting by
 * name and submission time works from the keyboard through the DataTable
 * header. A failed read is said as such, never shown as an empty list.
 */
export default function AssignmentOverview({ assignmentTitle, rows, loading = false, retryHref }: AssignmentOverviewProps) {
  if (rows === null && !loading) {
    // Design alignment 27. 11. 2026. (A2): the alert box, with the way to try again under it.
    return retryHref === undefined
      ? <LoadAlert>{t.unavailable}</LoadAlert>
      : <LoadAlert retry={{ label: t.retry, href: retryHref }}>{t.unavailable}</LoadAlert>;
  }
  return (
    <div className={styles.overview}>
      <DataTable
        caption={t.caption.replace("{assignment}", assignmentTitle)}
        columns={OVERVIEW_COLUMNS}
        rows={rows ?? []}
        rowKey={(row) => row.studentId}
        empty={t.noStudents}
        loading={loading}
      />
    </div>
  );
}
