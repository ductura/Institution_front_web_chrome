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

/** One course card (N-01): role, enrolled, code state, next deadline, the buttons and the tasks. */
export function AssignmentCard({ course, here, onIssued, extra }: {
  course: TeacherCourse; here: string; onIssued: () => void; extra?: React.ReactNode;
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
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id}>{course.name}</h2>
      <div className={styles.kv}>
        <Field name={t.role}>{unknown(roleText)}</Field>
        <Field name={t.enrolled}>{unknown(team.done ? enrolledText(team.view) : null)}</Field>
        <Field name={t.codeField}>{codeFieldText(role, issued)}</Field>
        <Field name={t.nextDeadline}>{next ? dueText(next.dueAt) : t.noDeadline}</Field>
        {course.assignments.length === 0 ? <Field name={t.tasks}>{t.noTasks}</Field> : null}
      </div>
      {code ? (
        <>
          <p className={styles.code} aria-label={t.codeLabel}>{code}</p>
          <p className={styles.meta}>{t.codeOnce}</p>
        </>
      ) : null}
      <div className={styles.acts}>
        <a className="btn secondary small" href={link("/nastavnik/studenti")}>{t.studentList}</a>
        {role !== "collaborator" ? <a className="btn secondary small" href={link(newAssignmentHref(course.id))}>{t.addTask}</a> : null}
        {role !== "collaborator" && next ? <a className="btn secondary small" href={link(extensionsHref(next.id))}>{t.extension}</a> : null}
        <a className="btn secondary small" href={link("/nastavnik/zbirni")}>{t.overview}</a>
        {role !== "collaborator" ? <a className="btn secondary small" href={link("/nastavnik/izvoz")}>{t.merlin}</a> : null}
        {role === "holder" ? <Button tone="quiet" onClick={() => setOpen(true)} aria-label={`${t.newCode}: ${course.name}`}>{t.newCode}</Button> : null}
      </div>
      {course.assignments.map((assignment) => (
        <div key={assignment.id} className={styles.task}>
          <h3>{assignment.title}</h3>
          <p className={styles.meta}>{t.due} {dueText(assignment.dueAt)}</p>
        </div>
      ))}
      {extra}
      <Dialog open={open} title={t.dialogTitle} onClose={close} dismissible={!busy}
        error={failure ? t.errors[failure] : undefined}
        actions={<>
          <Button tone="quiet" onClick={close}>{t.cancel}</Button>
          <Button busy={busy} onClick={() => void issue()}>{busy ? t.issuing : t.issue}</Button>
        </>}>
        <p className={styles.meta}>{t.dialogLead}</p>
      </Dialog>
    </section>
  );
}

/** The cards of N-01, or the empty state; the toast region lives here. */
export function AssignmentCards({ courses, here, extra }: {
  courses: readonly TeacherCourse[]; here: string; extra?: (course: TeacherCourse) => React.ReactNode;
}) {
  const { base } = useHost();
  const { toasts, show, dismiss } = useToasts();
  const newCourse = <a className="btn" href={appHref(base, "/nastavnik/zadatak/novi")}>{t.newCourse}</a>;
  if (courses.length === 0) {
    return <section className={`${styles.card} ${styles.center}`}><h2>{t.empty}</h2><p>{t.emptyLead}</p>{newCourse}</section>;
  }
  return (
    <>
      <div className={styles.acts}>{newCourse}</div>
      {courses.map((course) => (
        <AssignmentCard key={course.id} course={course} here={here} onIssued={() => show(t.issued)} extra={extra?.(course)} />
      ))}
      <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.toastLabel} closeLabel={t.toastClose} />
    </>
  );
}
