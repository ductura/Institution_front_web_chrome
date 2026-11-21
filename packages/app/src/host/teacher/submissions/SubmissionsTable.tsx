"use client";

import { DataTable, StateTag, type DataTableColumn } from "@ductura/ui";

import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";

import { submissionsMessages as t } from "./messages.hr";
import { viewHref, type TableRow } from "./model";

const label = (row: TableRow) =>
  `${row.name ?? t.noName} · ${row.group === null ? t.noGroup : t.group.replace("{group}", row.group)}`;

/** The columns of the table; `href` maps a path of the app onto the link of the current base. */
export function submissionColumns(href: (path: string) => string): readonly DataTableColumn<TableRow>[] {
  return [
    { id: "student", header: t.columns.student, rowHeader: true, cell: label, sortValue: (row) => row.name },
    { id: "revision", header: t.columns.revision, cell: (row) => (row.revision === null ? t.notSubmitted : String(row.revision)), sortValue: (row) => row.revision },
    {
      id: "time", header: t.columns.time,
      cell: (row) => (row.requestedMinute === null ? t.none : <time dateTime={row.requestedMinute}>{formatDateTimeHr(row.requestedMinute)}</time>),
      sortValue: (row) => (row.requestedMinute === null ? null : new Date(row.requestedMinute)),
    },
    // The tag is the server's `afterDeadline`; text always goes with it (§5).
    { id: "late", header: t.columns.late, cell: (row) => (row.late === null ? t.none : row.late ? <StateTag state="late" /> : t.onTime) },
    {
      id: "view", header: t.columns.view,
      cell: (row) => {
        const path = viewHref(row);
        return path === null ? t.none : <a href={href(path)} aria-label={t.viewFor.replace("{student}", label(row))}>{t.view}</a>;
      },
    },
  ];
}

export default function SubmissionsTable({ assignmentTitle, rows, href }: {
  assignmentTitle: string; rows: readonly TableRow[]; href: (path: string) => string;
}) {
  return (
    <DataTable
      caption={t.caption.replace("{assignment}", assignmentTitle)}
      columns={submissionColumns(href)}
      rows={rows}
      rowKey={(row) => row.studentId}
      empty={t.empty}
    />
  );
}
