"use client";

import { Button, Dialog, PracticeBadge, Select, ToastRegion, useToasts } from "@ductura/ui";
import { useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { createTeachingTeam, type TeachingTeamView } from "../../../../../../src/client/teaching-team";
import { appHref } from "../../../../../../src/components/shell/nav";
import { codeOutcome, defaultValidUntil, validUntilInstant } from "../../../../../../src/components/teacher/kolegiji/course-codes";
import { newAssignmentHref } from "../../../../../../src/components/teacher/links";
import type { TeacherCourse } from "../../../../../../src/components/teacher/teacher-courses-read";
import { useHost } from "../../context";
import { assignmentCardMessages as t } from "./messages.hr";
import {
  codeFieldText, courseOverviewPath, dueText, enrolledText, nextDeadline, pickedPath, roleOf, taskOptions, taskPaths,
  type CardRole, type TaskPick,
} from "./model";
import { usePractice } from "./practice";
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

/** The caller's role in the card being drawn, for the task entries inside it (NZ-1). */
const CardRoleContext = createContext<CardRole>("unknown");

/**
 * NZ-1: the entries of one assignment, each a page of the host: Predaje, Uredi (nova verzija), Kopiraj zadatak,
 * Produljenje, Izvoz and Brz put kroz radove (with `?zadatak=`). A collaborator reads and comments only
 * (INVENTAR §7 t. 5), so the entries that write are not offered to them; the server decides the rest.
 */
export function TaskActions({ assignment }: { assignment: { readonly id: string; readonly title: string } }) {
  const { base } = useHost();
  const role = useContext(CardRoleContext);
  const paths = taskPaths(assignment.id);
  const writes = role !== "collaborator";
  const link = (path: string, label: string, primary = false) => (
    <a className={primary ? "btn small" : "btn secondary small"} href={appHref(base, path)} aria-label={`${label}: ${assignment.title}`}>{label}</a>
  );
  return (
    <div className="acts" role="group" aria-label={`${t.taskActions}: ${assignment.title}`}>
      {link(paths.submissions, t.submissions)}
      {writes ? link(paths.edit, t.edit) : null}
      {writes ? link(paths.copy, t.copy) : null}
      {writes ? link(paths.extension, t.taskExtension) : null}
      {writes ? link(paths.merlin, t.taskMerlin) : null}
      {link(paths.fastPath, t.fastPath, true)}
    </div>
  );
}

/** The card's own task list (title, deadline, "Probni", the entries), used when no task facts are passed in. */
function CardTasks({ course }: { course: TeacherCourse }) {
  const practice = usePractice(course.assignments);
  return course.assignments.map((assignment) => (
    <div key={assignment.id} className={styles.task}>
      <h3>{assignment.title}</h3>
      <p className="meta">{t.due} {dueText(assignment.dueAt)} <PracticeBadge practice={practice.get(assignment.id)} /></p>
      <TaskActions assignment={assignment} />
    </div>
  ));
}

/**
 * NZ-2: "Produljenje roka…" and "Izvoz za Merlin…" ask which assignment of the course; every assignment is
 * offered, one whose deadline has passed too (Daniel, NF-4 odluka 5). "Nastavi" is a link to that page.
 */
function TaskPicker({ course, pick, onClose }: { course: TeacherCourse; pick: TaskPick | null; onClose: () => void }) {
  const { base } = useHost();
  const [chosen, setChosen] = useState("");
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setChosen("");
    setTried(false);
  }, [pick]);
  const path = pick === null ? null : pickedPath(course, pick, chosen);
  return (
    <Dialog open={pick !== null} title={pick === null ? "" : t.pickTitle[pick]} onClose={onClose}
      actions={<>
        {path === null ? <Button onClick={() => setTried(true)}>{t.pickGo}</Button>
          : <a className="btn" href={appHref(base, path)}>{t.pickGo}</a>}
        <Button tone="secondary" onClick={onClose}>{t.cancel}</Button>
      </>}>
      {pick === null ? null : <p className="note">{t.pickLead[pick]}</p>}
      <Select label={t.pickLabel} placeholder={t.pickPlaceholder} value={chosen} options={taskOptions(course, Date.now())}
        error={tried && path === null ? t.pickNone : undefined}
        onChange={(event) => { setChosen(event.target.value); setTried(false); }} />
    </Dialog>
  );
}

/** "Novi kolegij i zadatak": the head's action when there are courses, the card's when there are none. */
export function NewCourseLink() {
  const { base } = useHost();
  return <div className="acts"><a className="btn" href={appHref(base, "/nastavnik/zadatak/novi")}>{t.newCourse}</a></div>;
}

/** One course card (N-01): role, enrolled, code state, next deadline, the buttons and the tasks. */
export function AssignmentCard({ course, here, onIssued, extra, tasks, askCode = false }: {
  course: TeacherCourse; here: string; onIssued: () => void; extra?: React.ReactNode;
  /** The tasks with their facts (WEB-2145); without it, title and deadline only. */
  tasks?: React.ReactNode;
  /** NZ-1: `?kod=<courseId>` (from the empty N-04 "Izdaj novi kod") opens dk-h once the holder is known. */
  askCode?: boolean;
}) {
  const { base } = useHost();
  const team = useTeam(course.id);
  const role: CardRole = roleOf(team.view);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pick, setPick] = useState<TaskPick | null>(null);
  const next = nextDeadline(course, Date.now());
  const hasTasks = course.assignments.length > 0;
  const asked = useRef(false);
  useEffect(() => {
    if (!askCode || asked.current || role !== "holder") return;
    asked.current = true;
    setOpen(true);
  }, [askCode, role]);
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
    <CardRoleContext.Provider value={role}>
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
        {role !== "collaborator" && hasTasks
          ? <button type="button" className={small} aria-haspopup="dialog" onClick={() => setPick("extension")}>{t.extension}</button> : null}
        <a className={small} href={link(courseOverviewPath(course.id))}>{t.overview}</a>
        {role !== "collaborator" && hasTasks
          ? <button type="button" className={small} aria-haspopup="dialog" onClick={() => setPick("merlin")}>{t.merlin}</button> : null}
        {role === "holder" ? <button type="button" className={small} onClick={() => setOpen(true)} aria-label={`${t.newCode}: ${course.name}`}>{t.newCode}</button> : null}
      </div>
      {tasks ?? <CardTasks course={course} />}
      {extra}
      <Dialog open={open} title={t.dialogTitle} onClose={close} dismissible={!busy}
        error={failure ? t.errors[failure] : undefined}
        actions={<>
          <Button busy={busy} onClick={() => void issue()}>{busy ? t.issuing : t.issue}</Button>
          <Button tone="secondary" onClick={close}>{t.cancel}</Button>
        </>}>
        <p className="note">{t.dialogLead}</p>
      </Dialog>
      <TaskPicker course={course} pick={pick} onClose={() => setPick(null)} />
    </section>
    </CardRoleContext.Provider>
  );
}

/** The cards of N-01, or the empty state; the toast region lives here. */
export function AssignmentCards({ courses, here, extra, tasks }: {
  courses: readonly TeacherCourse[]; here: string; extra?: (course: TeacherCourse) => React.ReactNode;
  tasks?: (course: TeacherCourse) => React.ReactNode;
}) {
  const { base } = useHost();
  const { toasts, show, dismiss } = useToasts();
  const askCode = useSearchParams().get("kod");
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
          tasks={tasks?.(course)} askCode={askCode === course.id} />
      ))}
      <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.toastLabel} closeLabel={t.toastClose} />
    </>
  );
}
