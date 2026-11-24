"use client";

import { useEffect, useState } from "react";
import { Select } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { TeacherPage, type TeacherRead } from "../shell/TeacherPage";
import {
  extensionLine, groupOptions, listedStudents, loadRoster, notStartedCount, revisionLine, seminarDocumentId, stateLine, stateOptions,
  unavailablePort, workLabel,
  type CourseStudentsPort, type RosterData, type RosterRead, type StateFilter, type StudentOrder,
} from "./model";
import { courseStudentsMessages as text } from "./messages.hr";
import { aggregatePath } from "../course-aggregate/model";
import { issueCodePath } from "../assignment-card/model";
import { signInWhenSignedOut } from "./port";

/**
 * N-04 "Popis studenata" (WEB-2143): every student across the assignments of the course, alphabetical,
 * the state of each work in words, "Čeka doradu" as text only. Read-only: a collaborator sees the same.
 * A failed read says "unavailable" with a button, never an empty list.
 */
export default function CourseStudents({ courseId, port = unavailablePort }: { courseId: string; port?: CourseStudentsPort }) {
  const { base } = useHost();
  const [read, setRead] = useState<RosterRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [group, setGroup] = useState("");
  const [state, setState] = useState<StateFilter>("");
  const [order, setOrder] = useState<StudentOrder>("surname");

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

  return (
    <TeacherPage title={title} lead={text.lead} loading={text.loading} read={teacherRead} retry={() => setAttempt((n) => n + 1)}
      unavailable={text.unavailable} retryLabel={text.retry}
      actions={() => <a className="btn secondary" href={appHref(base, aggregatePath(courseId))}>{text.aggregateLink}</a>}
      ready={(roster) => roster.students.length === 0 ? (
        <section className="card center" aria-labelledby="n04-prazno">
          <h2 id="n04-prazno">{text.emptyTitle}</h2>
          <p className="note">{text.emptyBody}</p>
          <a className="btn" href={appHref(base, issueCodePath(courseId))}>{text.emptyAction}</a>
        </section>
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
                {student.works.map((work) => {
                  const doc = seminarDocumentId(work);
                  return doc === null ? null : (
                    <a key={`l-${work.assignmentId}`} className="rowlink" href={appHref(base, `/nastavnik/rad/${encodeURIComponent(doc)}`)}>{text.openSeminar}</a>
                  );
                })}
              </li>
            ))}
          </ul>
        </>
      )} />
  );
}
