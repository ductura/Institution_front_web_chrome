"use client";

import { Button, Checkbox, Select, TextArea, TextField } from "@ductura/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  AI_PURPOSES, assignmentBody, type AssignmentCreation, type AssignmentDraft, type WorkType,
} from "@/components/teacher/assignment-create";
import { publishAssignment } from "@/components/teacher/TeacherSetup/assignment-mutations";
import { assignmentSetupMessages as setup } from "@/components/teacher/TeacherSetup/messages.hr";
import type { TeacherCourse } from "@/components/teacher/teacher-courses-read";
import { formatDateTimeHr } from "@/lib/i18n/hr";
import { wordRangeHr } from "@/lib/i18n/length-line";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { checkForm, errorSummary, withPractice, type FormErrors } from "./form-checks";
import { ImportAllowedField } from "./ImportAllowedField";
import { assignmentFormHr as f } from "./messages.hr";

type Course = Pick<TeacherCourse, "id" | "name" | "academicYear" | "aiPolicy">;
/** `practice` is the practice-assignment flag (WEB-1901); the server stores it and returns it, no grade field exists for it. */
type PracticeBody = NonNullable<ReturnType<typeof assignmentBody>> & { practice?: true };
type Publish = (courseId: string, body: PracticeBody, requestKey: string) => Promise<AssignmentCreation>;
type FormDraft = AssignmentDraft & { practice?: boolean };
type Phase = "form" | "review" | "publishing" | "published";

const a = t.teacher.assignment;
const workOptions = (["seminar_paper", "essay"] as const).map((value) => ({ value, label: a.workTypes[value] }));
const initialDraft: FormDraft = {
  title: "", workType: "seminar_paper", opensAt: "", dueAt: "", instructions: "",
  wordMin: "", wordMax: "", aiPurposes: [...AI_PURPOSES],
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>;
}

/** A radio with a visible label; `disabled` options stay visible so the teacher sees what is not available yet. */
function Radio({ name, value, current, label, disabled, onPick }: {
  name: string; value: string; current: string; label: string; disabled?: boolean; onPick?: (value: string) => void;
}) {
  return (
    <label>
      <input type="radio" name={name} value={value} checked={current === value} disabled={disabled}
        onChange={() => onPick?.(value)} /> {label}
    </label>
  );
}

/**
 * The teacher's "Novi zadatak" (WEB-2146, N-02/N-03): one form in sections zs-1 to zs-4, then a separate
 * "Pregled i objava" with "Objavi zadatak" and "Natrag na obrazac" (kartice: not a five-step wizard).
 * Publishing calls the existing create-assignment route (`publishAssignment`); `publish` is injectable for tests.
 */
export default function AssignmentForm({ course, publish = publishAssignment, cancelHref = "/nastavnik" }: {
  course: Course; publish?: Publish; cancelHref?: string;
}) {
  const request = useRef<{ body: string; key: string } | null>(null);
  const summary = useRef<HTMLParagraphElement>(null);
  const [draft, setDraft] = useState<FormDraft>(initialDraft);
  const [phase, setPhase] = useState<Phase>("form");
  const [errors, setErrors] = useState<FormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const courseProhibits = course.aiPolicy === "prohibited";
  const set = <K extends keyof FormDraft>(key: K, value: FormDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const allowsHelp = !courseProhibits && draft.aiPurposes.length > 0;
  const summaryText = errorSummary(errors);

  useEffect(() => { if (summaryText) summary.current?.focus(); }, [summaryText]);

  function toReview() {
    const found = checkForm(draft);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length === 0) setPhase("review");
  }

  async function confirm() {
    const body = assignmentBody(draft, course.aiPolicy);
    if (!body) { setPhase("form"); setFailure(a.errors.invalid); return; }
    const aiBody = withPractice(courseProhibits || body.aiPurposes.length === 0 ? body : { ...body, aiPolicy: course.aiPolicy }, draft);
    const serialized = JSON.stringify(aiBody);
    // One retry key per body, so a repeated click after an unclear reply cannot create a second assignment.
    if (request.current?.body !== serialized) request.current = { body: serialized, key: crypto.randomUUID() };
    setFailure(null);
    setPhase("publishing");
    const result = await publish(course.id, aiBody, request.current.key);
    if (result.kind === "available") setPhase("published");
    else { setFailure(a.errors[result.kind]); setPhase("review"); }
  }

  const heading = <p>{course.name} · {course.academicYear}</p>;

  if (phase === "published") {
    return <section aria-label={`${course.name} · ${course.academicYear}`}>{heading}<p role="status">{setup.publishedNotice}</p></section>;
  }

  if (phase === "review" || phase === "publishing") {
    const range = wordRangeHr({ min: draft.wordMin.trim() ? Number(draft.wordMin) : null, max: draft.wordMax.trim() ? Number(draft.wordMax) : null });
    const busy = phase === "publishing";
    return (
      <section aria-labelledby="po-h2" aria-busy={busy || undefined}>
        {heading}
        <p>{f.reviewIntro}</p>
        <h2 id="po-h2">{f.reviewHeading}</h2>
        <dl>
          <dt>{f.labels.course}</dt><dd>{course.name}</dd>
          <dt>{f.labels.kind}</dt><dd>{draft.practice === true ? f.values.practice : f.values.regular}</dd>
          <dt>{f.labels.title}</dt><dd>{draft.title.trim()}</dd>
          <dt>{f.labels.workType}</dt><dd>{a.workTypes[draft.workType as "seminar_paper" | "essay"]}</dd>
          <dt>{f.labels.opens}</dt><dd>{formatDateTimeHr(draft.opensAt)}</dd>
          <dt>{f.labels.due}</dt><dd>{formatDateTimeHr(draft.dueAt)}</dd>
          {range && <><dt>{f.labels.words}</dt><dd>{range}</dd></>}
          <dt>{f.labels.groups}</dt><dd>{f.values.groupsAll}</dd>
          <dt>{f.labels.ai}</dt><dd>{allowsHelp ? f.values.aiCourse : f.values.aiNone}</dd>
          <dt>{f.labels.tools}</dt><dd>{f.values.toolsUnavailable}</dd>
        </dl>
        <p>{f.reviewNote}</p>
        {busy && <p role="status">{a.pending}</p>}
        {failure && <p role="alert">{failure}</p>}
        <p>
          <Button type="button" busy={busy} onClick={() => void confirm()}>{busy ? a.pending : f.publish}</Button>{" "}
          <Button type="button" tone="quiet" disabled={busy} onClick={() => setPhase("form")}>{f.backToForm}</Button>
        </p>
      </section>
    );
  }

  const invalid = (field: keyof FormErrors) => (errors[field] ? { error: errors[field] } : {});
  return (
    <section aria-label={`${course.name} · ${course.academicYear}`}>
      <h2>{f.heading}</h2>
      <p>{f.intro}</p>
      {summaryText && <p id="wz-err" role="alert" tabIndex={-1} ref={summary}>{f.errorsPrefix} {summaryText}</p>}
      {failure && <p role="alert">{failure}</p>}
      <p>{f.course}: <b>{course.name} · {course.academicYear}</b></p>

      <Section id="zs-1" title={f.sections.basics}>
        <TextField label={f.fields.title} value={draft.title} maxLength={160} autoComplete="off" hint={f.fields.titleHint}
          {...invalid("title")} onChange={(event) => set("title", event.target.value)} />
        <Select label={f.fields.workType} value={draft.workType} options={workOptions}
          onChange={(event) => set("workType", event.target.value as WorkType)} />
        <TextArea label={f.fields.description} rows={4} value={draft.instructions} maxLength={20_000}
          {...invalid("instructions")} onChange={(event) => set("instructions", event.target.value)} />
        <Checkbox label={f.practice.label} checked={draft.practice === true} hint={draft.practice === true ? f.practice.hint : f.practice.off}
          onChange={(event) => set("practice", event.target.checked)} />
      </Section>

      <Section id="zs-2" title={f.sections.schedule}>
        <TextField label={f.fields.opens} type="datetime-local" value={draft.opensAt} hint={f.fields.opensHint}
          {...invalid("opensAt")} onChange={(event) => set("opensAt", event.target.value)} />
        <TextField label={f.fields.due} type="datetime-local" value={draft.dueAt} hint={f.fields.dueHint}
          {...invalid("dueAt")} onChange={(event) => set("dueAt", event.target.value)} />
        <TextField label={f.fields.wordMin} inputMode="numeric" value={draft.wordMin}
          onChange={(event) => set("wordMin", event.target.value)} />
        <TextField label={f.fields.wordMax} inputMode="numeric" value={draft.wordMax}
          {...invalid("wordMax")} onChange={(event) => set("wordMax", event.target.value)} />
        <fieldset disabled>
          <legend>{f.groups.legend}</legend>
          <label><input type="checkbox" checked readOnly /> {setup.groups}</label>
          <p>{f.groups.unavailable}</p>
        </fieldset>
      </Section>

      <Section id="zs-3" title={f.sections.rules}>
        <p>{f.rules.note}</p>
        <fieldset>
          <legend>{f.rules.aiLegend}</legend>
          {!courseProhibits && (
            <Radio name="ai" value="course" current={allowsHelp ? "course" : "none"} label={f.rules.aiCourse}
              onPick={() => set("aiPurposes", [...AI_PURPOSES])} />
          )}
          <Radio name="ai" value="summary" current="" label={f.rules.aiSummary} disabled />
          <Radio name="ai" value="none" current={allowsHelp ? "course" : "none"} label={f.rules.aiNone}
            onPick={() => set("aiPurposes", [])} />
          <p>{courseProhibits ? f.rules.courseProhibits : f.rules.aiSummaryUnavailable}</p>
        </fieldset>
        <fieldset disabled>
          <legend>{f.rules.toolsLegend}</legend>
          <Radio name="tools" value="yes" current="" label={f.rules.toolsYes} disabled />
          <Radio name="tools" value="no" current="" label={f.rules.toolsNo} disabled />
          <p>{f.rules.toolsUnavailable}</p>
        </fieldset>
        <ImportAllowedField value={draft.importAllowed === true} onChange={(value) => set("importAllowed", value)} />
        <p>{f.rules.seen}</p>
      </Section>

      <Section id="zs-4" title={f.sections.recorded}>
        <p>{f.recorded.note}</p>
        <ul>{f.recorded.items.map((text) => <li key={text}>{text}</li>)}</ul>
        <p>{f.recorded.scope}</p>
      </Section>

      <p>{f.submitHint}</p>
      <p>
        <Button type="button" onClick={toReview}>{f.review}</Button>{" "}
        <a href={cancelHref}>{f.cancel}</a>
      </p>
    </section>
  );
}
