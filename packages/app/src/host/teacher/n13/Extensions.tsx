"use client";

import { useEffect, useState } from "react";
import { Button, Select, Skeleton, TextField } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/shell/nav";
import { goToSignIn } from "../../../../../../src/client/api";
import { zagrebInstant } from "../../../../../../src/lib/i18n/zagreb";
import { useHost } from "../../context";
import { detailText, leadText, loadN13, noteOf, reasonOptions, recordN13, titleText, unavailablePort, type N13Port, type N13Read, type Note } from "./model";
import { n13Messages as text } from "./messages.hr";

/**
 * N-13 "Produljenje roka" (WEB-2162): the form (one student or all, the new deadline in Zagreb time, a reason from
 * the closed list) and the list "Produljeni rokovi". A note follows only the server's answer (B-6); after a recorded
 * extension the page reads again. A failed read says so with a button, never an empty list.
 */
export default function N13Extensions({ assignmentId, port = unavailablePort }: { assignmentId: string; port?: N13Port }) {
  const { base } = useHost();
  const [read, setRead] = useState<N13Read | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [scope, setScope] = useState<"one" | "all">("one");
  const [studentId, setStudentId] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    let live = true;
    void loadN13(port, assignmentId).then((next) => {
      if (!live) return;
      if (next.kind === "signedOut") goToSignIn(appHref(base, `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/produljenje`));
      setRead(next);
    });
    return () => { live = false; };
  }, [port, assignmentId, attempt, base]);

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

  return (
    <div className="page">
      <h1>{text.title}</h1>
      {data !== null && <p>{leadText(data.context)}</p>}
      {read === null && <Skeleton label={text.loading} />}
      {read?.kind === "signedOut" && <p role="status">{text.loading}</p>}
      {read?.kind === "unavailable" && (
        <div>
          <p role="alert">{text.unavailable}</p>
          <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</button>
        </div>
      )}
      {data !== null && (
        <>
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
              <Button type="button" onClick={() => void submit()} disabled={busy}>{busy ? text.saving : text.save}</Button>
              <a className="btn secondary" href={appHref(base, "/nastavnik")}>{text.cancel}</a>
            </div>
          </div>
          <section className="card" aria-labelledby="pl-h">
            <h2 id="pl-h">{text.listTitle}</h2>
            {data.extensions === null ? (
              <div>
                <p role="alert">{text.listUnavailable}</p>
                <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</button>
              </div>
            ) : data.extensions.length === 0 ? <p className="note">{text.empty}</p> : (
              <>
                <ul className="list">
                  {data.extensions.map((e) => (
                    <li key={e.id} className="item">
                      <span className="title">{titleText(e, students)}</span>
                      <span className="meta">{detailText(e)}</span>
                    </li>
                  ))}
                </ul>
                <p className="meta">{text.keptNote}</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
