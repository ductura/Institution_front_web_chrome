"use client";

import { useEffect, useState } from "react";
import { Button, DataTable, type DataTableColumn } from "@ductura/ui";

import type {
  SubmittedRow, TeacherSubmissionsPort, VersionRead,
} from "../../../../../../src/client/teacher-submissions.ts";
import {
  answeredPanel, canOpen, documentBlocks, failureMessage, forAssignment, lateTag, submittedAt,
  type DocumentBlock, type ListState, type VersionPanel,
} from "./model";
import { submissionsMessages as text } from "./messages.hr";

/**
 * The submissions of one assignment in its detail (WEB-1502; M7.2): student, revision, time and the
 * server's "after the deadline" tag, and the submitted version read only. A version is read only
 * when the teacher opens it, because the server records each opening.
 * TODO(ugovor): the contract names no student, so the caller may pass names it already holds.
 */
export default function TeacherSubmissions(
  { port, assignmentId, names = {} }:
  { port: TeacherSubmissionsPort; assignmentId: string; names?: Readonly<Record<string, string>> },
) {
  const [list, setList] = useState<ListState>(null);
  const [attempt, setAttempt] = useState(0);
  const [openPanel, setPanel] = useState<VersionPanel>(null);
  const read = forAssignment(list, assignmentId)?.read ?? null;
  const panel = forAssignment(openPanel, assignmentId);
  const nameOf = (row: SubmittedRow) => names[row.studentId] ?? row.studentId;

  useEffect(() => {
    let active = true;
    void port.list(assignmentId)
      .then((next) => { if (active) setList({ assignmentId, read: next }); })
      .catch(() => { if (active) setList({ assignmentId, read: { kind: "nepoznato" } }); });
    return () => { active = false; };
  }, [port, assignmentId, attempt]);

  const open = async (row: SubmittedRow) => {
    setPanel({ assignmentId, row, read: "loading" });
    const next = await port.open(assignmentId, row.studentId).catch((): VersionRead => ({ kind: "nepoznato" }));
    setPanel((current) => answeredPanel(current, assignmentId, row, next));
  };

  const columns: readonly DataTableColumn<SubmittedRow>[] = [
    { id: "student", header: text.student, rowHeader: true, cell: nameOf, sortValue: nameOf },
    { id: "revision", header: text.revision, numeric: true, cell: (row) => row.revision, sortValue: (row) => row.revision },
    { id: "time", header: text.time, cell: submittedAt, sortValue: (row) => row.requestedMinute },
    { id: "tag", header: text.tag, cell: (row) => lateTag(row) },
    {
      id: "open", header: text.open,
      cell: (row) => (canOpen(row)
        ? <Button tone="quiet" onClick={() => void open(row)}>{text.open}</Button>
        : text.pending),
    },
  ];

  if (read !== null && read.kind !== "ready") {
    return (
      <div>
        <p role="alert">{failureMessage(read, "list")}</p>
        {read.kind !== "greska" && <Button tone="quiet" onClick={() => { setList(null); setAttempt((n) => n + 1); }}>{text.retry}</Button>}
      </div>
    );
  }

  return (
    <section aria-labelledby="submissions-h">
      <h2 id="submissions-h">{text.title}</h2>
      <DataTable caption={text.caption} columns={columns} rows={read?.rows ?? []} rowKey={(row) => `${row.studentId}:${row.revision}`}
        empty={text.empty} loading={read === null} loadingLabel={text.loading} />
      {panel !== null && <SubmittedVersionView panel={panel} student={nameOf(panel.row)} onClose={() => setPanel(null)} />}
    </section>
  );
}

function SubmittedVersionView(
  { panel: { row, read: version }, student, onClose }: { panel: NonNullable<VersionPanel>; student: string; onClose: () => void },
) {
  const body = version === "loading"
    ? <p role="status">{text.versionLoading}</p>
    : version.kind !== "ready"
      ? <p role="alert">{failureMessage(version)}</p>
      : <DocumentText view={documentBlocks(version.version.document)} />;
  return (
    <section aria-labelledby="submitted-version-h" data-readonly="true">
      <h3 id="submitted-version-h">{text.versionTitle}: {student}</h3>
      <p>{text.revision} {row.revision}</p>
      <p>{text.versionNote}</p>
      {body}
      <Button tone="quiet" onClick={onClose}>{text.close}</Button>
    </section>
  );
}

function DocumentText({ view }: { view: ReturnType<typeof documentBlocks> }) {
  if (view.kind === "unreadable") return <p role="alert">{text.unreadable}</p>;
  const block = (b: DocumentBlock, i: number) => {
    if (b.kind === "heading") return <h4 key={i}>{b.text}</h4>;
    if (b.kind === "quote") return <blockquote key={i}>{b.text}</blockquote>;
    return <p key={i}>{b.kind === "bulletItem" ? `• ${b.text}` : b.text}</p>;
  };
  return <article>{view.blocks.map(block)}</article>;
}
