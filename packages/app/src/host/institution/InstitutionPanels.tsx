"use client";

import { Button, Card, Dialog, KeyValueList, Notice, Select, Tag, TextField } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { zagrebParts } from "@/components/summary/zagreb-time";
import { pluralHr } from "@/lib/i18n/hr";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { assignGroupTeacher, createCourseGroup, groupName, MAX_GROUP_NAME, type GroupOutcome } from "./groups";
import { courseGroupMessages as g, institutionHostMessages as h } from "./messages.hr";
import {
  changeCourseStudent, changeTeacherRole, readAcademicYears, readAdminCourses, readTeacherRoles,
  type FailedKind, type InstitutionCourse, type Read, type RoleAction, type RoleOutcome, type StudentAction, type StudentOutcome, type TeacherRoles,
} from "./reads";
import { chosenYear, displayName, overviewCounts, yearLabel } from "./views";

type State<T> = { kind: "loading" } | Read<T>;

const failure = (kind: FailedKind, unavailable: string): string =>
  kind === "signedOut" ? h.signedOut : kind === "denied" ? h.denied : unavailable;

/** One read per visit and per "Pokušaj ponovno". */
function useRead<T>(read: () => Promise<Read<T>>): [State<T>, () => void] {
  const [state, setState] = useState<State<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    void read().then((value) => {
      if (live) setState(value);
    });
    return () => {
      live = false;
    };
    // `read` is a fresh closure each render; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  return [state, () => setAttempt((n) => n + 1)];
}

function Waiting({ title }: { title: string }) {
  return <Card level={2} title={title} busy />;
}

function Failed({ title, message, retry, retryLabel }: { title: string; message: string; retry: () => void; retryLabel: string }) {
  return (
    <Card level={2} title={title} error={message}>
      <Button tone="secondary" onClick={retry}>{retryLabel}</Button>
    </Card>
  );
}

// ---- /ustanova (A-01) -------------------------------------------------------------------------

type OverviewRead = { roles: TeacherRoles; year: string | null; courses: readonly InstitutionCourse[] };

async function readOverview(): Promise<Read<OverviewRead>> {
  const [roles, years] = await Promise.all([readTeacherRoles(), readAcademicYears()]);
  if (roles.kind !== "ok") return roles;
  if (years.kind !== "ok") return years;
  const year = chosenYear(years.value, null);
  if (year === null) return { kind: "ok", value: { roles: roles.value, year, courses: [] } };
  const courses = await readAdminCourses(year);
  return courses.kind === "ok" ? { kind: "ok", value: { roles: roles.value, year, courses: courses.value } } : courses;
}

const number = new Intl.NumberFormat("hr-HR");

/** The counts of the administrator's own institution, each with what it counts. */
export function OverviewPanel() {
  const t = messagesHr.institutionOverview;
  const [state, retry] = useRead(readOverview);
  if (state.kind === "loading") return <Waiting title={h.loading} />;
  if (state.kind !== "ok") return <Failed title={t.title} message={failure(state.kind, t.unavailable)} retry={retry} retryLabel={t.retry} />;
  const counts = overviewCounts(state.value.roles, state.value.courses);
  const year = state.value.year;
  const notes = {
    courses: year === null ? h.noYear : h.coursesNote.replace("{year}", yearLabel(year)),
    students: year === null ? h.noYear : h.studentsNote,
  };
  const order = ["confirmedTeachers", "teacherCandidates", "teachersWithoutAffiliation", "courses", "students"] as const;
  return (
    <section aria-label={t.countsLabel}>
      <p>{t.lead}</p>
      <KeyValueList items={order.map((key) => ({
        id: key,
        label: t.counts[key].label,
        value: <>{number.format(counts[key])} <span>{key === "courses" || key === "students" ? notes[key] : t.counts[key].note}</span></>,
      }))} />
    </section>
  );
}

// ---- /ustanova/korisnici (A-02) ---------------------------------------------------------------

type RoleStep =
  | { kind: "idle" }
  | { kind: "asking" | "working"; action: RoleAction; personId: string; name: string }
  | { kind: "done"; action: RoleAction; personId: string; name: string; outcome: RoleOutcome["kind"] };

const outcomeLine = (action: RoleAction, kind: RoleOutcome["kind"]): string => {
  const o = messagesHr.teacherRoles.outcome;
  switch (kind) {
    case "confirmed": return o.confirmed;
    case "revoked": return o.revoked;
    case "notCandidate": return o.notCandidate;
    case "notConfirmed": return o.notConfirmed;
    case "unauthorized":
    case "forbidden": return o.ended;
    case "invalid": return o.invalid;
    case "unknown": return action === "confirm" ? o.unknownConfirm : o.unknownRevoke;
  }
};

const dateOf = (iso: string) => zagrebParts(iso)?.date ?? "";

/** The two lists of "Korisnici i uloge" and the dialog that confirms or revokes a teacher role. */
export function UsersPanel() {
  const t = messagesHr.teacherRoles;
  const [state, retry] = useRead(readTeacherRoles);
  const [step, setStep] = useState<RoleStep>({ kind: "idle" });
  const inFlight = useRef(false);
  const safe = useRef<HTMLButtonElement>(null);

  const send = useCallback(async () => {
    if (step.kind !== "asking" || inFlight.current) return;
    inFlight.current = true;
    const { action, personId, name } = step;
    setStep({ ...step, kind: "working" });
    const { kind } = await changeTeacherRole(action, personId);
    inFlight.current = false;
    // Only an unknown outcome keeps the dialog: it offers "Provjeri stanje". Any other closes it and the lists are read again.
    setStep({ kind: "done", action, personId, name, outcome: kind });
    if (kind !== "unknown") retry();
  }, [step, retry]);

  if (state.kind === "loading") return <Waiting title={h.loading} />;
  if (state.kind !== "ok") return <Failed title={t.title} message={failure(state.kind, t.unavailable)} retry={retry} retryLabel={t.retry} />;

  const { pending, confirmed } = state.value;
  const working = step.kind === "working";
  const unknown = step.kind === "done" && step.outcome === "unknown";
  const open = step.kind === "asking" || working || unknown;
  const copy = step.kind !== "idle" && "revoke" === step.action ? t.revokeDialog : t.confirmDialog;
  const line = step.kind === "done" && !unknown ? outcomeLine(step.action, step.outcome) : null;
  const ask = (action: RoleAction, personId: string, name: string) => setStep({ kind: "asking", action, personId, name });
  const leave = () => setStep({ kind: "idle" });
  const check = () => {
    leave();
    retry();
  };

  return (
    <div>
      <div role="status">{line !== null && step.kind === "done" && (step.outcome === "confirmed" || step.outcome === "revoked") ? <p>{line}</p> : null}</div>
      <div role="alert">{line !== null && step.kind === "done" && step.outcome !== "confirmed" && step.outcome !== "revoked" ? <p>{line}</p> : null}</div>

      <Card level={2} title={t.pending.heading} empty={pending.length === 0 ? t.pending.empty : undefined}>
        {pending.length === 0 ? undefined : (
          <>
            <p>{t.pending.note}</p>
            <ul>
              {pending.map((p) => {
                const name = displayName(p.name, t.unnamed);
                return (
                  <li key={p.personId}>
                    <span>{name}</span>{" "}
                    {p.revokedAt ? <span>{t.pending.revokedOn} {dateOf(p.revokedAt)}</span> : null}{" "}
                    <Button size="small" disabled={working} onClick={() => ask("confirm", p.personId, name)}>{t.confirmAction}</Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Card level={2} title={t.confirmed.heading} empty={confirmed.length === 0 ? t.confirmed.empty : undefined}>
        {confirmed.length === 0 ? undefined : (
          <ul>
            {confirmed.map((c) => {
              const name = displayName(c.name, t.unnamed);
              return (
                <li key={c.personId}>
                  <span>{name}</span>{" "}
                  <span>{t.confirmed.confirmedOn} {dateOf(c.confirmedAt)}</span>{" "}
                  {c.forReview ? <Tag>{t.review.mark}</Tag> : null}
                  {c.forReview ? <p>{t.review.note}</p> : null}
                  <Button tone="secondary" size="small" disabled={working} onClick={() => ask("revoke", c.personId, name)}>{t.revokeAction}</Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog
        open={open}
        title={copy.title}
        dismissible={!working}
        onClose={leave}
        initialFocus={safe}
        error={unknown && step.kind === "done" ? outcomeLine(step.action, "unknown") : undefined}
        actions={unknown ? (
          <>
            <Button onClick={check}>{t.check}</Button>
            <Button ref={safe} tone="secondary" onClick={leave}>{t.close}</Button>
          </>
        ) : (
          <>
            <Button busy={working} onClick={() => void send()}>
              {step.kind !== "idle" && "revoke" === step.action ? t.revokeAction : t.confirmAction}
            </Button>
            <Button ref={safe} tone="secondary" busy={working} onClick={leave}>{t.cancel}</Button>
          </>
        )}
      >
        {step.kind !== "idle" ? <p>{t.person}: <strong>{step.name}</strong></p> : null}
        {unknown ? null : <ul>{copy.points.map((point) => <li key={point}>{point}</li>)}</ul>}
      </Dialog>
    </div>
  );
}

// ---- /ustanova/kolegiji (A-03) ----------------------------------------------------------------

type Teachers = TeacherRoles["confirmed"];
type CoursesRead = { years: readonly string[]; year: string | null; courses: readonly InstitutionCourse[]; teachers: Teachers | null };

const groupLine = (outcome: GroupOutcome, done: string): string =>
  outcome === "ok" ? done : outcome === "invalid" ? g.invalid : outcome === "unknown" ? g.unknown : g.ended;

type GroupToolsProps = {
  course: InstitutionCourse;
  teachers: Teachers | null;
  unnamed: string;
  /** Tells the panel what happened and, after a change, asks it to read the courses again. */
  report: (outcome: GroupOutcome, done: string) => void;
};

/** A new group of one course, and a confirmed teacher for each of its groups. Nothing is shown as done before the server says so. */
function GroupTools({ course, teachers, unnamed, report }: GroupToolsProps) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);

  const run = async (action: () => Promise<GroupOutcome>, done: string, onOk: () => void) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    const outcome = await action();
    inFlight.current = false;
    setWorking(false);
    if (outcome === "ok") onOk();
    report(outcome, done);
  };

  return (
    <>
      <section aria-label={`${g.newGroupHeading}: ${course.name}`}>
        <h3>{g.newGroupHeading}</h3>
        <TextField label={g.nameLabel} hint={g.nameHint} maxLength={MAX_GROUP_NAME} value={name} disabled={working}
          onChange={(event) => setName(event.target.value)} />
        <Button disabled={working || groupName(name) === null}
          onClick={() => void run(() => createCourseGroup(course.courseId, name), g.created, () => setName(""))}>{g.create}</Button>
      </section>
      {course.groups.length === 0 ? null : teachers === null ? <Notice tone="warn">{g.teachersUnavailable}</Notice> : course.groups.map((group) => {
        const taken = new Set(group.teachers.map((teacher) => teacher.personId));
        const options = teachers.filter((teacher) => !taken.has(teacher.personId));
        const chosen = picked[group.groupId] ?? "";
        return (
          <section key={group.groupId} aria-label={`${g.assignLabel}: ${group.name}`}>
            {options.length === 0 ? <Notice>{g.noTeachers}</Notice> : (
              <>
                <Select label={`${g.assignLabel}: ${group.name}`} value={chosen} placeholder={g.assignPlaceholder} disabled={working}
                  options={options.map((teacher) => ({ value: teacher.personId, label: displayName(teacher.name, unnamed) }))}
                  onChange={(event) => setPicked({ ...picked, [group.groupId]: event.target.value })} />
                <Button disabled={working || chosen === ""}
                  onClick={() => void run(() => assignGroupTeacher(group.groupId, chosen), g.assigned, () => setPicked({ ...picked, [group.groupId]: "" }))}>{g.assign}</Button>
              </>
            )}
          </section>
        );
      })}
    </>
  );
}

const count = (n: number, forms: { one: string; few: string; many: string }) => `${n} ${pluralHr(n, forms.one, forms.few, forms.many)}`;

/** The courses of one academic year with their holder, team and groups, read only. Students are counted, never named. */
export function CoursesPanel() {
  const t = messagesHr.institutionCourses;
  const unnamed = messagesHr.teacherRoles.unnamed;
  const [asked, setAsked] = useState<string | null>(null);
  const [state, retry] = useRead<CoursesRead>(async () => {
    const years = await readAcademicYears();
    if (years.kind !== "ok") return years;
    const year = chosenYear(years.value, asked);
    if (year === null) return { kind: "ok", value: { years: years.value, year, courses: [], teachers: null } };
    const [courses, roles] = await Promise.all([readAdminCourses(year), readTeacherRoles()]);
    if (courses.kind !== "ok") return courses;
    // A failed read of the teachers is not an empty list: the groups stay, the assignment says it is unavailable.
    return { kind: "ok", value: { years: years.value, year, courses: courses.value, teachers: roles.kind === "ok" ? roles.value.confirmed : null } };
  });
  const [change, setChange] = useState<{ ok: boolean; text: string } | null>(null);
  const report = useCallback((outcome: GroupOutcome, done: string) => {
    setChange({ ok: outcome === "ok", text: groupLine(outcome, done) });
    // Whatever the answer, the list is read again: an unknown outcome is settled by what the server holds.
    if (outcome === "ok" || outcome === "unknown") retryRef.current();
  }, []);
  const retryRef = useRef<() => void>(() => undefined);
  retryRef.current = retry;
  // A year picked in the list asks again for its own courses.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else retry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked]);

  if (state.kind === "loading") return <Waiting title={h.loading} />;
  if (state.kind !== "ok") return <Failed title={t.title} message={failure(state.kind, t.unavailable)} retry={retry} retryLabel={t.retry} />;
  const { years, year, courses, teachers } = state.value;
  if (year === null) {
    return <Card level={2} title={t.noCourses}><p>{t.emptyNote}</p></Card>;
  }
  const names = (people: readonly { name: Parameters<typeof displayName>[0] }[]) => people.map((p) => displayName(p.name, unnamed)).join(", ");
  return (
    <section aria-label={t.yearHeading.replace("{year}", yearLabel(year))}>
      <div role="status">{change?.ok === true ? <p>{change.text}</p> : null}</div>
      <div role="alert">{change !== null && !change.ok ? <p>{change.text}</p> : null}</div>
      <Select label={t.yearsLabel} value={year} options={years.map((y) => ({ value: y, label: yearLabel(y) }))}
        onChange={(event) => setAsked(event.target.value)} />
      {courses.length === 0 ? <Card level={2} title={t.emptyYear}><p>{t.emptyNote}</p></Card> : courses.map((course) => (
        <Card key={course.courseId} level={2} title={course.name}>
          <Tag>{count(course.students, t.enrolled)}</Tag>
          <KeyValueList items={[
            { id: "holder", label: t.holder, value: course.holder === null ? t.noHolder : displayName(course.holder.name, unnamed) },
            { id: "team", label: t.team, value: course.team.length === 0 ? t.noTeam : names(course.team) },
          ]} />
          <StudentActions courseId={course.courseId} onChanged={retry} />
          {course.groups.length === 0 ? <Notice>{t.noGroups}</Notice> : course.groups.map((group) => (
            <section key={group.groupId} aria-label={group.name}>
              <h3>{group.name}</h3>
              {group.teachers.length === 0
                ? <Notice tone="warn">{t.noTeacher}. {t.noTeacherNote}</Notice>
                : <p>{group.teachers.length === 1 ? t.groupTeacher.one : t.groupTeacher.many}: {names(group.teachers)}</p>}
              <p>{count(group.students, t.students)}</p>
            </section>
          ))}
          <GroupTools course={course} teachers={teachers} unnamed={unnamed} report={report} />
        </Card>
      ))}
    </section>
  );
}

// ---- removal and return of a student (OPE-R03) -------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const studentLine = (action: StudentAction, kind: StudentOutcome["kind"]): string => {
  const o = h.student.outcome;
  switch (kind) {
    case "done": return action === "remove" ? o.removed : o.returnAllowed;
    case "nothing": return action === "remove" ? o.notRemoved : o.notAllowed;
    case "unauthorized":
    case "forbidden": return o.ended;
    case "invalid": return o.invalid;
    case "unknown": return o.unknown;
  }
};

type StudentStep = { kind: "idle" } | { kind: "asking" | "working"; action: StudentAction } | { kind: "done"; action: StudentAction; outcome: StudentOutcome["kind"] };

/** Removes a student from one course or permits the return, over the existing routes, after a confirmation. */
export function StudentActions({ courseId, onChanged }: { courseId: string; onChanged: () => void }) {
  const t = h.student;
  const [studentId, setStudentId] = useState("");
  const [step, setStep] = useState<StudentStep>({ kind: "idle" });
  const inFlight = useRef(false);
  const safe = useRef<HTMLButtonElement>(null);
  const id = studentId.trim();
  const valid = UUID.test(id);
  const working = step.kind === "working";

  const send = async () => {
    if (step.kind !== "asking" || inFlight.current) return;
    inFlight.current = true;
    const { action } = step;
    setStep({ kind: "working", action });
    const { kind } = await changeCourseStudent(action, courseId, id);
    inFlight.current = false;
    setStep({ kind: "done", action, outcome: kind });
    if (kind === "done") {
      setStudentId("");
      onChanged();
    }
  };

  const action = step.kind === "asking" || step.kind === "working" ? step.action : null;
  const ok = step.kind === "done" && (step.outcome === "done" || step.outcome === "nothing");
  return (
    <section aria-label={t.heading}>
      <h3>{t.heading}</h3>
      <p>{t.lead}</p>
      <TextField label={t.field} hint={t.hint} value={studentId} autoComplete="off" spellCheck={false}
        error={id !== "" && !valid ? t.invalidId : undefined} onChange={(event) => setStudentId(event.target.value)} />
      <Button tone="secondary" size="small" disabled={!valid || working} onClick={() => setStep({ kind: "asking", action: "remove" })}>{t.remove}</Button>{" "}
      <Button tone="secondary" size="small" disabled={!valid || working} onClick={() => setStep({ kind: "asking", action: "return" })}>{t.allowReturn}</Button>
      <div role="status">{step.kind === "done" && ok ? <p>{studentLine(step.action, step.outcome)}</p> : null}</div>
      <div role="alert">{step.kind === "done" && !ok ? <p>{studentLine(step.action, step.outcome)}</p> : null}</div>
      <Notice>{t.directEnrolment}</Notice>
      <Dialog
        open={action !== null}
        title={action === "return" ? t.returnTitle : t.removeTitle}
        dismissible={!working}
        onClose={() => setStep({ kind: "idle" })}
        initialFocus={safe}
        actions={(
          <>
            <Button busy={working} onClick={() => void send()}>{action === "return" ? t.allowReturn : t.remove}</Button>
            <Button ref={safe} tone="secondary" busy={working} onClick={() => setStep({ kind: "idle" })}>{t.cancel}</Button>
          </>
        )}
      >
        <p>{action === "return" ? t.returnNote : t.removeNote}</p>
      </Dialog>
    </section>
  );
}
