"use client";

// WEB-2145: the tasks of one N-01 course card with their facts, and the banner of an interrupted publish.
// Layout only: the classes are those of the course card (assignment-card) and @ductura/ui components.
import { PracticeBadge, Skeleton } from "@ductura/ui";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { readTeacherCourses, type TeacherCourse, type TeacherCoursesCall } from "../../../../../../src/components/teacher/teacher-courses-read";
import { useHost } from "../../context";
import cardStyles from "../assignment-card/AssignmentCards.module.css";
import { assignmentCardMessages as card } from "../assignment-card/messages.hr";
import { dueText } from "../assignment-card/model";
import { usePractice } from "../assignment-card/practice";
import { TeacherToastRegion, useTeacherToasts } from "../toast";
import { assignmentFactsMessages as text } from "./messages.hr";
import { factsOf, interruptedOf, publishedIn, type AssignmentReads } from "./model";
import { readCourseFacts, type CourseFactsRead } from "./read";

/** The facts of one course, read once per visit and per "Pokušaj ponovno". */
function useCourseFacts(course: TeacherCourse): [CourseFactsRead | null, () => void] {
  const { base } = useHost();
  const [read, setRead] = useState<CourseFactsRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead(null);
    void readCourseFacts(createApi(), course.id, course.assignments).then((answer) => {
      if (!live) return;
      if (answer.kind === "signedOut") goToSignIn(appHref(base, "/nastavnik"));
      setRead(answer);
    });
    return () => {
      live = false;
    };
    // The course id and its assignments are what is read; `attempt` asks again.
  }, [base, course.id, course.assignments, attempt]);
  return [read, () => setAttempt((n) => n + 1)];
}

function Facts({ reads }: { reads: AssignmentReads }) {
  const { base } = useHost();
  const facts = factsOf(reads, Date.now());
  if (facts.opened === null) return <p className="note">{text.noStudents}</p>;
  return (
    <>
      <p className="note">{facts.opened}</p>
      <p className="note">{facts.sum}</p>
      {facts.rows.map((row) => (
        <div key={row.studentId} className={cardStyles.subRow}>
          <span className={cardStyles.who}>{row.name}</span>
          <span className={cardStyles.factsLine}>{row.line}</span>
          {row.kind === "notOpened" ? <span className="meta">{text.notStarted}</span>
            : row.documentId !== null ? (
              <a className="btn secondary small" href={appHref(base, `/nastavnik/rad/${encodeURIComponent(row.documentId)}`)}
                aria-label={`${text.openWork}: ${row.name}`}>{text.openWork}</a>
            ) : null}
        </div>
      ))}
    </>
  );
}

/** The tasks of one course card (N-01 korak A i B): title, deadline, facts and a row per student. */
export function CourseTasks({ course }: { course: TeacherCourse }) {
  const { base } = useHost();
  const [read, retry] = useCourseFacts(course);
  const practice = usePractice(course.assignments);
  return (
    <>
      {course.assignments.map((assignment, index) => (
        <div key={assignment.id} className={cardStyles.task}>
          <h3>{assignment.title}</h3>
          <p className="meta">{card.due} {dueText(assignment.dueAt)}{Date.parse(assignment.dueAt) < Date.now() ? ` · ${text.deadlinePassed}` : ""}{" "}
            <PracticeBadge practice={practice.get(assignment.id)} /></p>
          {read === null || read.kind === "signedOut" ? (
            <div><p className="meta">{text.loading}</p><Skeleton label={text.loading} lines={2} /></div>
          ) : read.kind === "unavailable" ? (
            <div>
              <p role="alert" className="note">{text.unavailable}</p>
              <div className="acts"><button type="button" className="btn secondary small" onClick={retry}>{text.retry}</button></div>
            </div>
          ) : read.reads.get(assignment.id) ? <Facts reads={read.reads.get(assignment.id) as AssignmentReads} /> : null}
          {index === 0 ? (
            <div className="acts"><a className="btn small" href={appHref(base, "/nastavnik/brz-put")}>{text.fastPath}</a></div>
          ) : null}
        </div>
      ))}
    </>
  );
}

/** The prototype banner `prekinuto`: the teacher checks the list before publishing again. */
export function InterruptedPublish({ onChecked }: { onChecked: () => void }) {
  const { base } = useHost();
  const which = interruptedOf(useSearchParams());
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { toasts, show, dismiss } = useTeacherToasts();

  async function check() {
    if (busy || which === null) return;
    setBusy(true);
    setFailed(false);
    const read = await readTeacherCourses(createApi() as unknown as TeacherCoursesCall).catch(() => ({ kind: "unavailable" }) as const);
    setBusy(false);
    if (read.kind === "signedOut") return goToSignIn(appHref(base, "/nastavnik"));
    if (read.kind !== "ready") return setFailed(true);
    const found = publishedIn(read.courses, which);
    setDone(true);
    window.history.replaceState(null, "", window.location.pathname);
    onChecked();
    // The toast only after the server's answer (decision 2164).
    show(found === null ? text.checkedUnknown : found ? text.checkedPublished : text.checkedNotPublished);
  }

  return (
    <>
      {which !== null && !done ? (
        <div className={`${cardStyles.banner}`} role="status">
          <p><b>{text.interruptedTitle(which.title)}</b> {text.interruptedBody}</p>
          {failed ? <p role="alert" className="err">{text.checkUnavailable}</p> : null}
          <div className="acts">
            <button type="button" className="btn secondary" disabled={busy} onClick={() => void check()}>{busy ? text.checking : text.check}</button>
          </div>
        </div>
      ) : null}
      <TeacherToastRegion toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
