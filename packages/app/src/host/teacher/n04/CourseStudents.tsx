"use client";

import { useEffect, useState } from "react";
import { Select, Skeleton } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import {
  groupOptions, loadRoster, revisionLine, seminarDocumentId, stateLine, unavailablePort, visibleStudents, workLabel,
  type CourseStudentsPort, type RosterRead,
} from "./model";
import { courseStudentsMessages as text } from "./messages.hr";

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

  useEffect(() => {
    let live = true;
    setRead(null);
    void loadRoster(port, courseId).then((next) => { if (live) setRead(next); });
    return () => { live = false; };
  }, [courseId, port, attempt]);

  const data = read?.kind === "ready" ? read.data : null;
  const title = data?.courseName ? text.courseTitle(data.courseName) : text.title;
  const options = data === null ? [] : groupOptions(data.students);
  const shown = data === null ? [] : visibleStudents(data.students, options.some((o) => o.value === group) ? group : "");

  return (
    <div className="page">
      <h1>{title}</h1>
      <p>{text.lead}</p>
      {read === null && <Skeleton label={text.loading} />}
      {read?.kind === "signedOut" && <p role="alert">{text.signedOut}</p>}
      {read?.kind === "unavailable" && (
        <div>
          <p role="alert">{text.unavailable}</p>
          <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</button>
        </div>
      )}
      {data !== null && data.students.length === 0 && (
        <section aria-labelledby="n04-prazno">
          <h2 id="n04-prazno">{text.emptyTitle}</h2>
          <p>{text.emptyBody}</p>
          <a className="btn" href={appHref(base, "/nastavnik/kolegiji")}>{text.emptyAction}</a>
        </section>
      )}
      {data !== null && data.students.length > 0 && (
        <div>
          {options.length > 0 && (
            <div id="f-gr" style={{ maxWidth: 280 }}>
              <Select label={text.filter} options={[...options]} value={options.some((o) => o.value === group) ? group : ""}
                onChange={(event) => setGroup(event.target.value)} />
            </div>
          )}
          <ul role="list" style={{ listStyle: "none", padding: 0 }}>
            {shown.map((student) => (
              <li key={student.studentId} data-testid="n04-student" style={{ borderBlockEnd: "1px solid var(--rule)", paddingBlockEnd: 12 }}>
                <p><strong>{student.name ?? text.noName}</strong>{student.group ? ` · ${student.group}` : ""}</p>
                {student.works.length === 0 && <p>{text.noWorks}</p>}
                {student.works.map((work) => {
                  const doc = seminarDocumentId(work);
                  const waits = revisionLine(work);
                  return (
                    <div key={work.assignmentId} data-testid="n04-work">
                      <p>{workLabel(work)}: {stateLine(work)}.{waits === null ? "" : ` ${waits}`}</p>
                      {doc !== null && <a href={appHref(base, `/nastavnik/rad/${encodeURIComponent(doc)}`)}>{text.openSeminar}</a>}
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
