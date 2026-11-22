"use client";

import { ActionRow, Button, Checkbox, FieldGrid, FormSection as Section, Notice, OptionGroup, Select, SummaryList, TextArea, TextField } from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

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
import { publishHr } from "../publish/messages.hr";
import { CheckListLink, PublishDone } from "../publish/PublishDone";
import { isUncertain, publishOutcome } from "../publish/publish-outcome";

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
  const [uncertain, setUncertain] = useState(false);
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
    const outcome = publishOutcome(result);
    setUncertain(isUncertain(result));
    if (outcome.ok) setPhase("published");
    else { setFailure(outcome.error ?? a.errors.unavailable); setPhase("review"); }
  }

  const heading = <p className="lede">{f.intro}</p>;

  if (phase === "published") {
    return <section aria-label={`${course.name} · ${course.academicYear}`} className="card"><PublishDone /></section>;
  }

  if (phase === "publishing") {
    return <section className="card" aria-busy="true" aria-label={`${course.name} · ${course.academicYear}`}><p role="status" className="note">{a.pending}</p></section>;
  }

  if (phase === "review") {
    const range = wordRangeHr({ min: draft.wordMin.trim() ? Number(draft.wordMin) : null, max: draft.wordMax.trim() ? Number(draft.wordMax) : null });
    const rows = [
      { id: "course", label: f.labels.course, value: course.name },
      { id: "kind", label: f.labels.kind, value: draft.practice === true ? f.values.practice : f.values.regular },
      { id: "title", label: f.labels.title, value: draft.title.trim() },
      { id: "workType", label: f.labels.workType, value: a.workTypes[draft.workType as "seminar_paper" | "essay"] },
      { id: "opens", label: f.labels.opens, value: formatDateTimeHr(draft.opensAt) },
      { id: "due", label: f.labels.due, value: formatDateTimeHr(draft.dueAt) },
      ...(range ? [{ id: "words", label: f.labels.words, value: range }] : []),
      { id: "groups", label: f.labels.groups, value: f.values.groupsAll },
      { id: "ai", label: f.labels.ai, value: allowsHelp ? f.values.aiCourse : f.values.aiNone },
      { id: "tools", label: f.labels.tools, value: f.values.toolsUnavailable },
    ];
    return (
      <>
        <p className="lede">{f.reviewIntro}</p>
        {uncertain && <CheckListLink courseId={course.id} title={draft.title.trim()} />}
        <section className="card" aria-labelledby="po-h2">
          <h2 id="po-h2">{f.reviewHeading}</h2>
          <SummaryList rows={rows} />
          <p className="note">{publishHr.reviewNote}</p>
          {failure && <p className="note" role="alert">{failure}</p>}
          <ActionRow>
            <Button type="button" onClick={() => void confirm()}>{f.publish}</Button>
            <Button type="button" tone="secondary" onClick={() => setPhase("form")}>{f.backToForm}</Button>
          </ActionRow>
        </section>
      </>
    );
  }

  const invalid = (field: keyof FormErrors) => (errors[field] ? { error: errors[field] } : {});
  const aiValue = allowsHelp ? "course" : "none";
  return (
    <>
      {heading}
      <div className="card" role="group" aria-label={`${course.name} · ${course.academicYear}`}>
        {summaryText && <p id="wz-err" className="err" role="alert" tabIndex={-1} ref={summary}>{f.errorsPrefix} {summaryText}</p>}
        {failure && <p className="err" role="alert">{failure}</p>}
        <SummaryList rows={[{ id: "course", label: f.course, value: `${course.name} · ${course.academicYear}` }]} />

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
          <FieldGrid>
            <TextField label={f.fields.opens} type="datetime-local" value={draft.opensAt} hint={f.fields.opensHint}
              {...invalid("opensAt")} onChange={(event) => set("opensAt", event.target.value)} />
            <TextField label={f.fields.due} type="datetime-local" value={draft.dueAt} hint={f.fields.dueHint}
              {...invalid("dueAt")} onChange={(event) => set("dueAt", event.target.value)} />
            <TextField label={f.fields.wordMin} inputMode="numeric" value={draft.wordMin}
              onChange={(event) => set("wordMin", event.target.value)} />
            <TextField label={f.fields.wordMax} inputMode="numeric" value={draft.wordMax}
              {...invalid("wordMax")} onChange={(event) => set("wordMax", event.target.value)} />
          </FieldGrid>
          {/* The create route has no `groupIds` yet: the group is shown, not sent (f.groups.unavailable). */}
          <OptionGroup legend={f.groups.legend} name="groups" kind="checkbox" value={["all"]} disabled
            options={[{ value: "all", label: setup.groups }]} />
          <p className="meta">{f.groups.unavailable}</p>
        </Section>

        <Section id="zs-3" title={f.sections.rules}>
          <p className="note">{f.rules.note}</p>
          <OptionGroup legend={f.rules.aiLegend} name="ai" value={aiValue}
            options={[
              ...(courseProhibits ? [] : [{ value: "course", label: f.rules.aiCourse }]),
              { value: "summary", label: f.rules.aiSummary, disabled: true },
              { value: "none", label: f.rules.aiNone },
            ]}
            onChange={(value) => set("aiPurposes", value === "course" ? [...AI_PURPOSES] : [])} />
          <p className="meta">{courseProhibits ? f.rules.courseProhibits : f.rules.aiSummaryUnavailable}</p>
          <OptionGroup legend={f.rules.toolsLegend} name="tools" value="" disabled
            options={[{ value: "yes", label: f.rules.toolsYes }, { value: "no", label: f.rules.toolsNo }]} />
          <p className="meta">{f.rules.toolsUnavailable}</p>
          <ImportAllowedField value={draft.importAllowed === true} onChange={(value) => set("importAllowed", value)} />
          <p className="meta">{f.rules.seen}</p>
        </Section>

        <Section id="zs-4" title={f.sections.recorded}>
          <p className="note">{f.recorded.note}</p>
          <ul className="facts">{f.recorded.items.map((text) => <li key={text}>{text}</li>)}</ul>
          <p className="note">{f.recorded.scope}</p>
        </Section>

        <p className="meta">{f.submitHint}</p>
        <ActionRow>
          <Button type="button" onClick={toReview}>{f.review}</Button>
          <a className="btn secondary" href={cancelHref}>{f.cancel}</a>
        </ActionRow>
      </div>
    </>
  );
}
