"use client";

import { Button, Dialog, Select } from "@ductura/ui";
import { useRef, useState } from "react";

import { signInHref, type ApiResult } from "@/client/api";
import type { TeacherCoursesRead } from "@/components/teacher/teacher-courses-read";
import { formatDateTimeHr } from "@/lib/i18n/hr";
import { wordRangeHr } from "@/lib/i18n/length-line";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { copyAssignment, readCopyCourses, type CopyResult } from "./client";
import { assignmentCopyMessages as t } from "./messages.hr";
import styles from "./assignment-copy.module.css";

const teacher = messagesHr.teacher;
type Current = Extract<ApiResult<"institution.assignment.get">, { ok: true }>["body"];
const editPath = (id: string) => `/nastavnik/zadatak/${encodeURIComponent(id)}/uredi`;

function CopyPreview({ current }: { current: Current }) {
  const range = wordRangeHr({ min: current.wordMin, max: current.wordMax });
  const purposes = current.aiPurposes.map((purpose) => teacher.tools.purposes[purpose]);
  return (
    <>
      <p>{t.scope}</p>
      <dl className={styles.preview}>
        <dt>{teacher.assignment.title}</dt><dd>{current.title}</dd>
        <dt>{teacher.assignment.instructions}</dt>
        <dd className={styles.instructions}>{current.instructions.trim() ? current.instructions : teacher.newVersion.empty}</dd>
        <dt>{teacher.assignment.opensAt}</dt><dd>{formatDateTimeHr(current.opensAt)}</dd>
        <dt>{teacher.assignment.dueAt}</dt><dd>{formatDateTimeHr(current.dueAt)}</dd>
        <dt>{teacher.course.policy}</dt>
        <dd>{teacher.course.policies[current.aiPolicy]}</dd>
        <dt>{teacher.tools.allowed}</dt>
        <dd>{purposes.length ? <ul>{purposes.map((text) => <li key={text}>{text}</li>)}</ul> : teacher.newVersion.noPurposes}</dd>
        {range && <><dt>{teacher.newVersion.fields.wordRange}</dt><dd>{range}</dd></>}
        <dt>{t.importLabel}</dt><dd>{current.importAllowed ? t.importAllowed : t.importForbidden}</dd>
      </dl>
      <p><strong>{t.excluded}</strong></p>
    </>
  );
}

export function AssignmentCopy({ current, href }: { current: Current; href: (path: string) => string }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<TeacherCoursesRead | null>(null);
  const [courseId, setCourseId] = useState("");
  const [copy, setCopy] = useState<CopyResult | null>(null);
  const [pending, setPending] = useState(false);
  const [keepTarget, setKeepTarget] = useState(false);
  const requestKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const loadId = useRef(0);

  async function loadCourses() {
    const id = ++loadId.current;
    setRead(null);
    const result = await readCopyCourses();
    if (id === loadId.current) setRead(result);
  }

  function show() {
    if (!keepTarget || copy?.kind === "copied") {
      setCopy(null);
      setKeepTarget(false);
      setCourseId("");
      requestKey.current = null;
      void loadCourses();
    }
    setOpen(true);
  }

  async function submit() {
    if (!courseId || inFlight.current || copy?.kind === "copied" || copy?.kind === "conflict") return;
    inFlight.current = true;
    setPending(true);
    // On an uncertain reply, keep both the target and key across retries and dialog dismissal.
    requestKey.current ??= crypto.randomUUID();
    const result = await copyAssignment(current.assignmentId, courseId, requestKey.current);
    if (result.kind === "unconfirmed" || result.kind === "conflict") setKeepTarget(true);
    setCopy(result);
    setPending(false);
    inFlight.current = false;
  }

  const done = copy?.kind === "copied";
  const signedOut = read?.kind === "signedOut" || copy?.kind === "signedOut";
  const readError = read && read.kind !== "ready" ? t.errors[read.kind] : undefined;
  const error = copy && copy.kind !== "copied" ? t.errors[copy.kind] : readError;
  const courses = read?.kind === "ready" ? read.courses : [];

  function close() {
    if (!inFlight.current) setOpen(false);
  }

  return (
    <>
      <p><Button tone="quiet" onClick={show}>{t.title}</Button></p>
      <Dialog open={open} title={t.title} onClose={close} dismissible={!pending} error={pending ? undefined : error}
        actions={<>
          <Button tone="quiet" onClick={close} disabled={pending}>{t.close}</Button>
          {read?.kind === "unavailable" && <Button onClick={loadCourses}>{messagesHr.teacherCourses.retry}</Button>}
          {!done && courses.length > 0 && (
            <Button onClick={submit} busy={pending} disabled={!courseId || signedOut || copy?.kind === "conflict"}>
              {pending ? t.pending : copy?.kind === "unconfirmed" ? t.retry : t.confirm}
            </Button>
          )}
        </>}>
        {copy?.kind === "copied" ? <>
          <p role="status">{t.success}</p>
          <p><a href={href(editPath(copy.id))}>{t.openCopy}</a></p>
        </> : <>
          {read === null && <p role="status">{t.loading}</p>}
          {read?.kind === "ready" && (courses.length === 0 ? <p role="status">{t.empty}</p> :
            <Select label={t.course} placeholder={t.choose} value={courseId} disabled={pending || keepTarget}
              onChange={(event) => {
                setCourseId(event.target.value);
                setCopy(null);
                requestKey.current = null;
              }}
              options={courses.map(({ id, name, academicYear }) => ({ value: id, label: `${name} · ${academicYear}` }))} />)}
          {signedOut && <p><a href={signInHref(href(editPath(current.assignmentId)))}>{t.signIn}</a></p>}
          <CopyPreview current={current} />
        </>}
      </Dialog>
    </>
  );
}
