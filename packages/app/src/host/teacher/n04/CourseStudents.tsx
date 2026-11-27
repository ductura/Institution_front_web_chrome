"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Select } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { TeacherPage, type TeacherRead } from "../shell/TeacherPage";
import {
  extensionLine, groupOptions, listedStudents, loadRoster, notStartedCount, revisionLine, seminarDocumentId, stateLine, stateOptions,
  unavailablePort, workLabel,
  changeLine, type CourseStudentsPort, type RosterData, type RosterRead, type StateFilter, type StudentChange, type StudentChangeAction,
  type StudentOrder,
} from "./model";
import { courseStudentsMessages as text } from "./messages.hr";
import { aggregatePath } from "../course-aggregate/model";
import { issueCodePath } from "../assignment-card/model";
import { signInWhenSignedOut } from "./port";
import CourseAssistantCard from "../course-assistant/CourseAssistantCard";
import type { CourseAssistantPort } from "../course-assistant/port";

/**
 * N-04 "Popis studenata" (WEB-2143): every student across the assignments of the course, alphabetical,
 * the state of each work in words, "Čeka doradu" as text only. A port with `change` adds removal and permitted
 * return (F4-PM1-R09), each after a confirmation; the server decides who may (403 is said, not hidden).
 * A failed read says "unavailable" with a button, never an empty list.
 */
export default function CourseStudents({ courseId, port = unavailablePort, assistant }: {
  courseId: string; port?: CourseStudentsPort;
  /** F4-PM1-R07: the course's switch of the Asistent; without a port the card is not shown. */
  assistant?: CourseAssistantPort;
}) {
  const { base } = useHost();
  const [read, setRead] = useState<RosterRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [group, setGroup] = useState("");
  const [state, setState] = useState<StateFilter>("");
  const [order, setOrder] = useState<StudentOrder>("surname");

  const [ask, setAsk] = useState<{ op: StudentChangeAction; studentId: string; name: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState<{ op: StudentChangeAction; outcome: StudentChange } | null>(null);
  // Students removed here stay offered for "Dopusti povratak": the roster no longer lists them.
  const [removed, setRemoved] = useState<readonly { studentId: string; name: string }[]>([]);
  const inFlight = useRef(false);
  const safe = useRef<HTMLButtonElement>(null);

  const send = async () => {
    if (ask === null || port.change === undefined || inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    let outcome: StudentChange;
    try { outcome = await port.change(ask.op, courseId, ask.studentId); } catch { outcome = "unknown"; }
    inFlight.current = false;
    setWorking(false);
    setDone({ op: ask?.op, outcome });
    setAsk(null);
    // A removal or a return that changed something: read the roster again, never patch it by hand.
    if (outcome === "done") {
      setAttempt((n) => n + 1);
      const { studentId, name } = ask;
      setRemoved((list) => ask?.op === "remove"
        ? (list.some((r) => r.studentId === studentId) ? list : [...list, { studentId, name }])
        : list.filter((r) => r.studentId !== studentId));
    }
  };

  useEffect(() => {
    let live = true;
    setRead(null);
    void loadRoster(port, courseId).then((next) => {
      if (!live) return;
      signInWhenSignedOut(next, base, courseId);
      setRead(next);
    });
    return () => { live = false; };
  }, [courseId, port, attempt, base]);

  const data = read?.kind === "ready" ? read.data : null;
  const title = data?.courseName ? text.courseTitle(data.courseName) : text.title;
  const options = data === null ? [] : groupOptions(data.students);
  const shown = data === null ? [] : listedStudents(data.students, options.some((o) => o.value === group) ? group : "", state, order);
  const teacherRead: TeacherRead<RosterData> | null = read === null ? null : read.kind === "ready" ? { kind: "ready", value: read.data } : { kind: read.kind };

  const assistantCard = assistant === undefined ? null : <CourseAssistantCard courseId={courseId} port={assistant} />;

  const dialog = (
    <Dialog open={ask !== null} dismissible={!working} onClose={() => setAsk(null)} initialFocus={safe}
      title={ask === null ? "" : ask?.op === "return" ? text.returnTitle(ask.name) : text.removeTitle(ask.name)}
      actions={(
        <>
          <Button busy={working} onClick={() => void send()}>{ask?.op === "return" ? text.allowReturn : text.remove}</Button>
          <Button ref={safe} tone="secondary" disabled={working} onClick={() => setAsk(null)}>{text.cancel}</Button>
        </>
      )}>
      <p>{ask?.op === "return" ? text.returnNote : text.removeNote}</p>
    </Dialog>
  );

  const removedSection = removed.length === 0 ? null : (
    <section aria-label={text.removedHeading} data-testid="n04-removed">
        <h3>{text.removedHeading}</h3>
        <ul className="list" role="list">
          {removed.map((r) => (
            <li key={r.studentId} className="item">
              <span className="title">{r.name}</span>
              <Button tone="secondary" size="small" disabled={working}
                onClick={() => setAsk({ op: "return", studentId: r.studentId, name: r.name })}>{text.allowReturn}</Button>
            </li>
          ))}
        </ul>
      </section>
  );

  return (
    <TeacherPage title={title} lead={text.lead} loading={text.loading} read={teacherRead} retry={() => setAttempt((n) => n + 1)}
      unavailable={text.unavailable} retryLabel={text.retry}
      actions={() => <a className="btn secondary" href={appHref(base, aggregatePath(courseId))}>{text.aggregateLink}</a>}
      ready={(roster) => roster.students.length === 0 ? (
        <>
        <section className="card center" aria-labelledby="n04-prazno">
          <h2 id="n04-prazno">{text.emptyTitle}</h2>
          <p className="note">{text.emptyBody}</p>
          <a className="btn" href={appHref(base, issueCodePath(courseId))}>{text.emptyAction}</a>
        </section>
        {removedSection}
        {assistantCard}
        {dialog}
        </>
      ) : (
        <>
          <p className="note" role="status" data-testid="n04-not-started">{text.notStartedCount(notStartedCount(roster.students))}</p>
          <div className="acts" role="group" aria-label={text.filter}>
            {options.length > 0 && (
              <Select label={text.filter} options={[...options]} value={options.some((o) => o.value === group) ? group : ""}
                onChange={(event) => setGroup(event.target.value)} />
            )}
            <Select label={text.stateLabel} options={[...stateOptions(roster.students)]} value={state}
              onChange={(event) => setState(event.target.value as StateFilter)} />
            <Select label={text.orderLabel} value={order} onChange={(event) => setOrder(event.target.value as StudentOrder)}
              options={[{ value: "surname", label: text.orderSurname }, { value: "state", label: text.orderState }]} />
          </div>
          {done !== null && (done.outcome === "done" || done.outcome === "nothing"
            ? <p className="note" role="status" data-testid="n04-change">{changeLine(done.op, done.outcome)}</p>
            : <p className="note" role="alert" data-testid="n04-change">{changeLine(done.op, done.outcome)}</p>)}
          {shown.length === 0 && <p className="note" role="status">{text.noMatch}</p>}
          <ul className="list" role="list">
            {shown.map((student) => (
              <li key={student.studentId} className="item" data-testid="n04-student">
                <span className="title">{student.name ?? text.noName}{student.group ? ` · ${student.group}` : ""}</span>
                {student.works.length === 0 && <span className="note">{text.noWorks}</span>}
                {student.works.map((work) => {
                  const waits = revisionLine(work);
                  const extended = extensionLine(work);
                  return <span key={work.assignmentId} className="note" data-testid="n04-work">{workLabel(work)}: {stateLine(work)}.{extended === null ? "" : ` ${extended}`}{waits === null ? "" : ` ${waits}`}</span>;
                })}
                {port.change !== undefined && (
                  <span className="acts">
                    <Button tone="secondary" size="small" disabled={working}
                      onClick={() => setAsk({ op: "remove", studentId: student.studentId, name: student.name ?? text.noName })}>{text.remove}</Button>
                    <Button tone="secondary" size="small" disabled={working}
                      onClick={() => setAsk({ op: "return", studentId: student.studentId, name: student.name ?? text.noName })}>{text.allowReturn}</Button>
                  </span>
                )}
                {student.works.map((work) => {
                  const doc = seminarDocumentId(work);
                  return doc === null ? null : (
                    <a key={`l-${work.assignmentId}`} className="rowlink" href={appHref(base, `/nastavnik/rad/${encodeURIComponent(doc)}`)}>{text.openSeminar}</a>
                  );
                })}
              </li>
            ))}
          </ul>
          {removedSection}
          {assistantCard}
          {dialog}
        </>
      )} />
  );
}
