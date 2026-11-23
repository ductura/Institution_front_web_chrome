"use client";

import { Button, Dialog, ToastRegion, useToasts } from "@ductura/ui";
import { useEffect, useState } from "react";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { createTeachingTeam, type TeachingTeamView } from "../../../../../../src/client/teaching-team";
import { appHref } from "../../../../../../src/components/shell/nav";
import { codeOutcome, defaultValidUntil, validUntilInstant } from "../../../../../../src/components/teacher/kolegiji/course-codes";
import { extensionsHref, newAssignmentHref } from "../../../../../../src/components/teacher/links";
import type { TeacherCourse } from "../../../../../../src/components/teacher/teacher-courses-read";
import { useHost } from "../../context";
import { submissionsHref } from "../submissions/port";
import { assignmentCardMessages as t } from "./messages.hr";
import { codeFieldText, dueText, enrolledText, nextDeadline, roleOf, type CardRole } from "./model";
import styles from "./AssignmentCards.module.css";

type Failure = keyof typeof t.errors;
type Issued = "now" | "before";

/** The role and the people of one course from the teaching-team view; null while unread or when it failed. */
function useTeam(courseId: string): { view: TeachingTeamView | null; done: boolean } {
  const [state, setState] = useState<{ view: TeachingTeamView | null; done: boolean }>({ view: null, done: false });
  useEffect(() => {
    let live = true;
    void createTeachingTeam(courseId).read().then((answer) => {
      if (live) setState({ view: answer.kind === "ready" ? answer.view : null, done: true });
    });
    return () => {
      live = false;
    };
  }, [courseId]);
  return state;
}

function Field({ name, children }: { name: string; children: string }) {
  return <div><span className={styles.label}>{name}</span>{children}</div>;
}

/** "Novi kolegij i zadatak": the head's action when there are courses, the card's when there are none. */
export function NewCourseLink() {
  const { base } = useHost();
  return <div className="acts"><a className="btn" href={appHref(base, "/nastavnik/zadatak/novi")}>{t.newCourse}</a></div>;
}

/** One course card (N-01): role, enrolled, code state, next deadline, the buttons and the tasks. */
export function AssignmentCard({ course, here, onIssued, extra, tasks }: {
  course: TeacherCourse; here: string; onIssued: () => void; extra?: React.ReactNode;
  /** The tasks with their facts (WEB-2145); without it, title and deadline only. */
  tasks?: React.ReactNode;
}) {
  const { base } = useHost();
  const team = useTeam(course.id);
  const role: CardRole = roleOf(team.view);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const next = nextDeadline(course, Date.now());
  const id = `kolegij-${course.id}`;
  const link = (path: string) => appHref(base, path);

  function close() {
    if (busy) return;
    setOpen(false);
    setFailure(null);
  }

  async function issue() {
    const validUntil = validUntilInstant(defaultValidUntil(Date.now()));
    if (busy || validUntil === null) return;
    setBusy(true);
    setFailure(null);
    const answer = await createApi()("institution.enrollment-code.post", {
      params: { courseId: course.id }, query: undefined, body: { validUntil },
    }).catch(() => ({ ok: false, status: 0, code: "unexpected" }) as const);
    setBusy(false);
    const outcome = codeOutcome(answer);
    if (outcome.kind === "signedOut") return goToSignIn(here);
    if (outcome.kind === "issued") {
      setCode(outcome.code);
      setIssued("now");
      setOpen(false);
      onIssued(); // the toast only after the server's answer (decision 2164)
    } else {
      // An unknown outcome may have replaced the code: never keep claiming the old one.
      if (outcome.kind === "unavailable") { setCode(null); setIssued(null); }
      setFailure(outcome.kind === "revoked" ? "unavailable" : outcome.kind);
    }
  }

  const unknown = (value: string | null) => value ?? t.unavailableValue;
  const roleText = role === "holder" ? t.roleHolder : role === "collaborator" ? t.roleCollaborator : null;
  const small = "btn secondary small";
  return (
    <section className={`card ${styles.course}`} aria-labelledby={id}>
      <h2 id={id}>{course.name}</h2>
      <div className={styles.kv}>
        <Field name={t.role}>{unknown(roleText)}</Field>
        <Field name={t.enrolled}>{unknown(team.done ? enrolledText(team.view) : null)}</Field>
        <Field name={t.codeField}>{codeFieldText(role, issued)}</Field>
        {course.assignments.length === 0 ? <Field name={t.tasks}>{t.noTasks}</Field>
          : <Field name={t.nextDeadline}>{next ? dueText(next.dueAt) : t.noDeadline}</Field>}
      </div>
      {code ? (
        <>
          <p className={styles.code} aria-label={t.codeLabel}>{code}</p>
          <p className="meta">{t.codeOnce}</p>
        </>
      ) : null}
      <div className="acts">
        <a className={small} href={link(`/nastavnik/kolegiji/${encodeURIComponent(course.id)}/studenti`)}>{t.studentList}</a>
        {role !== "collaborator" ? <a className={small} href={link(newAssignmentHref(course.id))}>{t.addTask}</a> : null}
        {role !== "collaborator" && next ? <a className={small} href={link(extensionsHref(next.id))}>{t.extension}</a> : null}
        <a className={small} href={link("/nastavnik/zbirni")}>{t.overview}</a>
        {role !== "collaborator" && course.assignments[0] !== undefined
          ? <a className={small} href={link(`/nastavnik/zadatak/${encodeURIComponent(course.assignments[0].id)}/merlin`)}>{t.merlin}</a> : null}
        {role === "holder" ? <button type="button" className={small} onClick={() => setOpen(true)} aria-label={`${t.newCode}: ${course.name}`}>{t.newCode}</button> : null}
      </div>
      {tasks ?? course.assignments.map((assignment) => (
        <div key={assignment.id} className={styles.task}>
          <h3>{assignment.title}</h3>
          <p className="meta">{t.due} {dueText(assignment.dueAt)}</p>
          <a className={small} href={link(submissionsHref(assignment.id))} aria-label={`${t.submissions}: ${assignment.title}`}>{t.submissions}</a>
        </div>
      ))}
      {extra}
      <Dialog open={open} title={t.dialogTitle} onClose={close} dismissible={!busy}
        error={failure ? t.errors[failure] : undefined}
        actions={<>
          <Button busy={busy} onClick={() => void issue()}>{busy ? t.issuing : t.issue}</Button>
          <Button tone="secondary" onClick={close}>{t.cancel}</Button>
        </>}>
        <p className="note">{t.dialogLead}</p>
      </Dialog>
    </section>
  );
}

/** The cards of N-01, or the empty state; the toast region lives here. */
export function AssignmentCards({ courses, here, extra, tasks }: {
  courses: readonly TeacherCourse[]; here: string; extra?: (course: TeacherCourse) => React.ReactNode;
  tasks?: (course: TeacherCourse) => React.ReactNode;
}) {
  const { base } = useHost();
  const { toasts, show, dismiss } = useToasts();
  if (courses.length === 0) {
    return (
      <section className="card center">
        <h2>{t.empty}</h2>
        <p className="note">{t.emptyLead}</p>
        <a className="btn" href={appHref(base, "/nastavnik/zadatak/novi")}>{t.newCourse}</a>
      </section>
    );
  }
  return (
    <>
      {courses.map((course) => (
        <AssignmentCard key={course.id} course={course} here={here} onIssued={() => show(t.issued)} extra={extra?.(course)}
          tasks={tasks?.(course)} />
      ))}
      <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.toastLabel} closeLabel={t.toastClose} />
    </>
  );
}
