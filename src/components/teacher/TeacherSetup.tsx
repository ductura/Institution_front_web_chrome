"use client";

import { Button, Select, TextArea, TextField } from "@ductura/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { goToSignIn } from "@/client/api";
import { formatDateTimeHr } from "@/lib/i18n/hr";
import { wordRangeHr } from "@/lib/i18n/length-line";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import {
  AI_PURPOSES, assignmentBody, type AssignmentBody, type AssignmentCreation, type AssignmentDraft, type WorkType,
} from "./assignment-create";
import { newAssignmentHref } from "./links";
import { publishAssignment } from "./TeacherSetup/assignment-mutations";
import { assignmentSetupMessages as wizard } from "./TeacherSetup/messages.hr";
import type { TeacherCourse } from "./teacher-courses-read";
import { yearHr } from "./TeacherCourses";
import styles from "./TeacherSetup.module.css";

type ExistingCourse = Pick<TeacherCourse, "id" | "name" | "academicYear" | "aiPolicy">;
type Step = 1 | 2 | 3 | 4 | 5;

const a = t.teacher.assignment;
const tools = t.teacher.tools;
const workOptions = (["seminar_paper", "essay"] as const).map((value) => ({ value, label: a.workTypes[value] }));
const noHelp = { value: "none", label: wizard.noHelp };
const helpOptions = [{ value: "course", label: wizard.courseHelp }, noHelp];
const initialDraft: AssignmentDraft = {
  title: "", workType: "seminar_paper", opensAt: "", dueAt: "", instructions: "",
  wordMin: "", wordMax: "", aiPurposes: [...AI_PURPOSES],
};

function ToolRestrictions({ banned }: { banned: readonly string[] }) {
  return (
    <>
      <p className={styles.listHead}>{tools.banned}</p>
      <ul className={styles.banned}>
        {[...banned, ...Object.values(tools.alwaysBanned)].map((text) => <li key={text}>{text}</li>)}
      </ul>
      {Object.values(tools.conditions).map((text) => <p key={text} className={styles.hint}>{text}</p>)}
      <p className={styles.hint}>{tools.source}</p>
    </>
  );
}

function StudentPreview({ body }: { body: AssignmentBody }) {
  const range = wordRangeHr({ min: body.wordMin, max: body.wordMax });
  const banned = AI_PURPOSES.filter((purpose) => !body.aiPurposes.includes(purpose));
  return (
    <section className={styles.card} aria-labelledby="pregled">
      <h3 id="pregled">{t.teacher.preview.heading}</h3>
      <p className={styles.listHead}>{body.title}</p>
      {/* Design alignment 27. 11. 2026. (A4): parts of a row are separate, 12 px apart. */}
      <p className={styles.row}>
        <span>{a.workTypes[body.workType]}</span>
        <span>{t.teacher.preview.opensFrom} {formatDateTimeHr(body.opensAt)}</span>
        <span>{t.teacher.preview.due} {formatDateTimeHr(body.dueAt)}</span>
      </p>
      {range && <p>{range}</p>}
      {body.instructions.trim() && <p className={styles.brief}>{body.instructions}</p>}
      <p className={styles.listHead}>{tools.allowed}</p>
      {body.aiPurposes.length > 0
        ? <ul className={styles.summary}>{body.aiPurposes.map((purpose) => <li key={purpose}>{tools.purposes[purpose]}</li>)}</ul>
        : <p>{t.student.noTools}</p>}
      <ToolRestrictions banned={banned.map((purpose) => tools.purposes[purpose])} />
      <p className={styles.hint}>{t.teacher.preview.rest}</p>
    </section>
  );
}

export default function TeacherSetup({ course }: { course: ExistingCourse }) {
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState<Step>(1);
  const [result, setResult] = useState<AssignmentCreation | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<{ body: string; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const published = result?.kind === "available";
  const uncertain = result?.kind === "unavailable";
  const courseProhibits = course.aiPolicy === "prohibited";
  const allowsHelp = !courseProhibits && draft.aiPurposes.length > 0;
  const checkedBody = step === 5 ? assignmentBody(draft, course.aiPolicy) : null;
  const body = checkedBody && allowsHelp ? { ...checkedBody, aiPolicy: course.aiPolicy } : checkedBody;

  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step, published]);

  function move(next: Step) {
    moved.current = true;
    setResult(null);
    setStep(next);
  }

  function edit<K extends keyof AssignmentDraft>(field: K, value: AssignmentDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setResult(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || published) return;
    if (step === 1) {
      if (!draft.title.trim() || [...draft.title.trim()].length > 160) return setResult({ kind: "invalid" });
      return move(2);
    }
    const checked = body ?? assignmentBody(draft, course.aiPolicy);
    if (!checked) return setResult({ kind: "invalid" });
    if (step === 2) return move(3);
    if (step === 3) return move(4);
    if (step === 4) return move(5);

    const serialized = JSON.stringify(checked);
    if (request.current?.body !== serialized) request.current = { body: serialized, key: crypto.randomUUID() };
    inFlight.current = true;
    setPending(true);
    try {
      const outcome = await publishAssignment(course.id, checked, request.current.key);
      // Design alignment 27. 11. 2026. (N-05): a lapsed session goes to sign-in and comes back here.
      if (outcome.kind === "unauthorized") return goToSignIn(newAssignmentHref(course.id));
      setResult(outcome);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const error = result && result.kind !== "available"
    ? step === 1 ? wizard.invalidTitle : a.errors[result.kind]
    : undefined;

  return (
    <section className={styles.card} aria-labelledby="zadatak">
      <p className={styles.listHead}>{course.name}, {yearHr(course.academicYear)}</p>
      <ol className={styles.steps} role="list">
        {wizard.steps.map((label, index) => (
          <li key={label} aria-current={index + 1 === step ? "step" : undefined}>{label}</li>
        ))}
      </ol>
      <h2 id="zadatak" ref={heading} tabIndex={-1}>{published ? a.published : wizard.steps[step - 1]}</h2>
      {published ? <p role="status">{wizard.publishedNotice}</p> : (
        <form onSubmit={submit}>
          <fieldset className={styles.fields} disabled={pending}>
            {step === 1 && <>
              <TextField label={a.title} value={draft.title} required maxLength={160} autoComplete="off"
                error={error} onChange={(event) => edit("title", event.target.value)} />
              <Select label={a.workType} value={draft.workType} options={workOptions}
                onChange={(event) => edit("workType", event.target.value as WorkType)} />
              <TextArea label={wizard.description} rows={4} value={draft.instructions} maxLength={20_000}
                onChange={(event) => edit("instructions", event.target.value)} />
            </>}
            {step === 2 && <>
              <div className={styles.pair}>
                <TextField label={a.opensAt} type="datetime-local" value={draft.opensAt} required hint={a.timesHint}
                  onChange={(event) => edit("opensAt", event.target.value)} />
                <TextField label={a.dueAt} type="datetime-local" value={draft.dueAt} required
                  onChange={(event) => edit("dueAt", event.target.value)} />
              </div>
              <div className={styles.pair}>
                <TextField label={a.wordMin} inputMode="numeric" value={draft.wordMin} hint={a.wordRangeHint}
                  onChange={(event) => edit("wordMin", event.target.value)} />
                <TextField label={a.wordMax} inputMode="numeric" value={draft.wordMax}
                  onChange={(event) => edit("wordMax", event.target.value)} />
              </div>
            </>}
            {step === 3 && <>
              <Select label={wizard.help} value={allowsHelp ? "course" : "none"}
                options={courseProhibits ? [noHelp] : helpOptions}
                hint={courseProhibits ? tools.courseProhibits : t.teacher.course.policies[course.aiPolicy]}
                onChange={(event) => edit("aiPurposes", event.target.value === "course" ? [...AI_PURPOSES] : [])} />
            </>}
            {step === 4 && <>
              <p>{wizard.recordingNotice}</p>
              <ul className={styles.summary}>{wizard.recorded.map((text) => <li key={text}>{text}</li>)}</ul>
              <p>{wizard.recordingScope}</p>
            </>}
            {body && <>
              <StudentPreview body={body} />
              <p className={styles.hint}>{t.teacher.existingCourse.studentsNotified} {wizard.noNotifications}</p>
            </>}
            {/* Step 1 says it at the title field only. */}
            {error && step !== 1 && <p className={styles.notice} role="alert">{error}</p>}
            <div className={styles.actions}>
              {step > 1 && !uncertain && <Button tone="quiet" onClick={() => move((step - 1) as Step)}>{wizard.back}</Button>}
              <Button type="submit" busy={pending}>{step === 5 ? pending ? a.pending : a.publish : wizard.next}</Button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
