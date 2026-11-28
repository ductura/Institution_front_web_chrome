"use client";

import { useEffect, useState } from "react";
import { Button, DataTable, Select, TextField, type DataTableColumn } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/shell/nav";
import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { zagrebInstant } from "../../../../../../src/lib/i18n/zagreb";
import { useHost } from "../../context";
import { readLateExceptions, type LateExceptionRecord } from "../assignment-facts/late-exception";
import { whenHr } from "../assignment-facts/model";
import { assignmentFactsMessages as lateText } from "../assignment-facts/messages.hr";
import { momentHr } from "../n12/model";
import type { DeadlineExtension } from "../../../../../../src/client/deadline-extensions";
import { deadlinePassed, detailText, filterByStudent, studentSeesText, leadText, loadN13, noteOf, reasonOptions, recordN13, submissionWarning, unavailablePort, whoText, type N13Port, type N13Read, type Note } from "./model";
import { n13Messages as text } from "./messages.hr";

/**
 * N-13 "Produljenje roka" (WEB-2162): the form (one student or all, the new deadline in Zagreb time, a reason from
 * the closed list) and the list "Produljeni rokovi". A note follows only the server's answer (B-6); after a recorded
 * extension the page reads again. A failed read says so with a button, never an empty list.
 */
export type LateExceptionsRead = (assignmentId: string) => ReturnType<typeof readLateExceptions>;
const readLate: LateExceptionsRead = (assignmentId) => readLateExceptions(createApi(), assignmentId);

export default function N13Extensions({ assignmentId, port = unavailablePort, readLate: readLateList = readLate }: { assignmentId: string; port?: N13Port; readLate?: LateExceptionsRead }) {
  const { base } = useHost();
  const [read, setRead] = useState<N13Read | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [scope, setScope] = useState<"one" | "all">("one");
  const [studentId, setStudentId] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [filter, setFilter] = useState("");
  /** null: not read yet; "unavailable": the read failed (said so, never an empty list). */
  const [late, setLate] = useState<readonly LateExceptionRecord[] | "unavailable" | null>(null);

  useEffect(() => {
    let live = true;
    void loadN13(port, assignmentId).then((next) => {
      if (!live) return;
      if (next.kind === "signedOut") goToSignIn(appHref(base, `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/produljenje`));
      setRead(next);
    });
    void readLateList(assignmentId).then((next) => {
      if (live) setLate(next.kind === "ready" ? next.exceptions : "unavailable");
    }, () => { if (live) setLate("unavailable"); });
    return () => { live = false; };
  }, [port, readLateList, assignmentId, attempt, base]);

  const data = read?.kind === "ready" ? read.data : null;
  const students = data?.students ?? null;
  const canPickOne = students !== null && students.length > 0;
  const effective = canPickOne ? scope : "all";

  async function submit() {
    if (busy) return;
    const dueAt = zagrebInstant(dueLocal);
    if (dueAt === null || reasonId === "" || (effective === "one" && studentId === "")) {
      setNote({ tone: "alert", bold: text.missing, rest: null });
      return;
    }
    setBusy(true);
    setNote(null);
    const outcome = await recordN13(port, assignmentId, { scope: effective, studentId, dueAt, reasonId });
    setBusy(false);
    if (outcome.kind === "session-expired") return goToSignIn(appHref(base, `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/produljenje`));
    setNote(noteOf(outcome, students));
    if (outcome.kind === "zabiljezeno") {
      setDueLocal("");
      setReasonId("");
      setAttempt((n) => n + 1);
    }
  }

  const extensionColumns: DataTableColumn<DeadlineExtension>[] = [
    { id: "student", header: text.student, rowHeader: true, cell: (e) => whoText(e, students) },
    { id: "due", header: text.due, cell: (e) => momentHr(e.dueAt) },
    {
      id: "reason", header: text.reason, cell: (e) => (
        <>
          <p className="meta">{detailText(e)}</p>
          <p className="meta">{studentSeesText(e)}</p>
          {e.reasonId === null && <p className="meta">{text.studentSeesHidden}</p>}
        </>
      ),
    },
  ];

  const warning = data === null ? null : submissionWarning(effective, studentId, students, data.submissions);

  return (
    <div className="page">
      <div className="pagehead">
        <h1>{text.title}</h1>
        {data !== null && <p className="lede">{leadText(data.context)}</p>}
      </div>
      {(read === null || read.kind === "signedOut") && (
        <section className="card" aria-busy="true">
          <p className="note" role="status">{text.loading}</p>
          <div className="skel w80" /><div className="skel w60" /><div className="skel w40" />
        </section>
      )}
      {read?.kind === "unavailable" && (
        <section className="card">
          <p className="note" role="alert">{text.unavailable}</p>
          <div className="sb-acts"><Button tone="secondary" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button></div>
        </section>
      )}
      {data !== null && (
        <>
          {deadlinePassed(data.context, Date.now()) && (
            <div className="banner" role="status">
              <p><b>{text.passedTitle}</b> {text.passedBody}</p>
              <p className="note">{text.exceptionNote}</p>
            </div>
          )}
          {note !== null && (
            <div className="banner" role={note.tone}>
              <p><b>{note.bold}</b>{note.rest === null ? null : ` ${note.rest}`}</p>
            </div>
          )}
          <div className="card" role="group" aria-label={text.formTitle}>
            <fieldset>
              <legend>{text.scope}</legend>
              {canPickOne && (
                <label className="opt"><input type="radio" name="za" value="one" checked={effective === "one"} onChange={() => setScope("one")} /> {text.scopeOne}</label>
              )}
              <label className="opt"><input type="radio" name="za" value="all" checked={effective === "all"} onChange={() => { setScope("all"); if (reasonId === "all") setReasonId(""); }} /> {text.scopeAll(students === null ? null : students.length)}</label>
            </fieldset>
            {students === null && <p className="meta">{text.studentsUnavailable}</p>}
            {effective === "all" ? <p className="note">{text.allNote}</p> : (
              <Select
                label={text.student}
                placeholder={text.studentPlaceholder}
                value={studentId}
                options={(students ?? []).map((s) => ({ value: s.studentId, label: s.name ?? text.unnamed }))}
                onChange={(e) => setStudentId(e.target.value)}
              />
            )}
            {warning !== null && <div className="banner" role={warning.tone} data-testid="n13-existing-submission"><p><b>{warning.bold}</b>{warning.rest === null ? null : ` ${warning.rest}`}</p></div>}
            <TextField label={text.due} hint={text.dueHint} type="datetime-local" value={dueLocal} onChange={(e) => setDueLocal(e.target.value)} />
            <Select
              label={text.reason}
              placeholder={text.reasonPlaceholder}
              hint={text.reasonHint(effective === "all")}
              value={reasonId}
              options={reasonOptions(effective)}
              onChange={(e) => setReasonId(e.target.value)}
            />
            <div className="sb-acts">
              <Button onClick={() => void submit()} busy={busy}>{busy ? text.saving : text.save}</Button>
              <a className="btn secondary" href={appHref(base, "/nastavnik")}>{text.cancel}</a>
            </div>
          </div>
          <section className="card">
            <h2>{text.listTitle}</h2>
            {data.extensions === null ? (
              <>
                <p className="note" role="alert">{text.listUnavailable}</p>
                <div className="sb-acts"><Button tone="secondary" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button></div>
              </>
            ) : data.extensions.length === 0 ? <p className="note">{text.empty}</p> : (
              <>
                {canPickOne && (
                  <Select
                    label={text.filter}
                    placeholder={text.filterAll}
                    value={filter}
                    options={(students ?? []).map((s) => ({ value: s.studentId, label: s.name ?? text.unnamed }))}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                )}
                <DataTable
                  caption={<span className="visually-hidden">{text.listTitle}</span>}
                  columns={extensionColumns}
                  rows={filterByStudent(data.extensions, filter)}
                  rowKey={(e) => e.id}
                  empty={text.filterEmpty}
                />
                <p className="meta">{text.keptNote}</p>
              </>
            )}
          </section>
          <section className="card" aria-labelledby="ki-h">
            <h2 id="ki-h">{text.lateTitle}</h2>
            {late === null ? <p className="note" role="status">{text.loading}</p> : late === "unavailable" ? (
              <>
                <p className="note" role="alert">{text.lateUnavailable}</p>
                <div className="sb-acts"><Button tone="secondary" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button></div>
              </>
            ) : late.length === 0 ? <p className="note">{text.lateEmpty}</p> : (
              <ul className="list">
                {late.map((e) => (
                  <li key={e.id} className="item">
                    <span className="title">{(students ?? []).find((s) => s.studentId === e.studentId)?.name ?? text.unnamed} <span className="badge">{text.lateMark}</span></span>
                    <span className="meta">{`${text.lateUntil} ${whenHr(e.untilAt) ?? e.untilAt}, ${text.reasonLabel}: ${e.reasonId === null ? text.reasonHidden : lateText.late.reasons[e.reasonId]}, ${text.recordedBy} ${e.reasonId === null ? text.byOther : text.byYou}, ${whenHr(e.createdAt) ?? e.createdAt}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
