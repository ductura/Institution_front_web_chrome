"use client";

import { ActionRow, Button, FieldGrid, FormSection as Section, OptionGroup, Select, SummaryList, TextArea, TextField } from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

import {
  AI_PURPOSES, assignmentBody, type AssignmentCreation, type AssignmentDraft, type WorkType,
} from "@/components/teacher/assignment-create";
import { createApi } from "@/client/api";
import { publishAssignment } from "@/components/teacher/TeacherSetup/assignment-mutations";
import { assignmentSetupMessages as setup } from "@/components/teacher/TeacherSetup/messages.hr";
import type { TeacherCourse } from "@/components/teacher/teacher-courses-read";
import { formatDateTimeHr } from "@/lib/i18n/hr";
import { wordRangeHr } from "@/lib/i18n/length-line";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { checkForm, errorSummary, withPractice, type FormErrors } from "./form-checks";
import { DocumentKindField, withDocumentKind, kindOf, type DocumentKind } from "./DocumentKindField";
import { ImportAllowedField } from "./ImportAllowedField";
import { PracticeField } from "./PracticeField";
import { QuestionField, checkQuestion, normalizeQuestion, saveQuestion, type QuestionOutcome } from "./QuestionField";
import { SubmissionRules, seesLine } from "./SubmissionRules";
import { applyRules, bodyExtras, defaultChoices, groupsMissing, readGroups, type Call, type GroupsRead, type RuleChoices, type RuleName } from "./rules";
import { assignmentFormHr as f, declarationQuestionHr as questionHr, documentKindHr, templateFieldHr } from "./messages.hr";
import { readOutline, saveTemplate, TemplateField, type LoadOutline, type TemplateOutcome } from "./TemplateField";
import { rubricFormHr } from "../rubric/messages.hr";
import { saveRubric, type SaveOutcome } from "../rubric/port";
import { RubricField } from "../rubric/RubricField";
import { checkRubric, type Rubric, type RubricErrors } from "../rubric/rubric-model";
import { publishHr } from "../publish/messages.hr";
import { CheckListLink, PublishDone } from "../publish/PublishDone";
import { isUncertain, publishOutcome } from "../publish/publish-outcome";
import { handOverPublished } from "../publish/published-handoff";
import { toastWhenConfirmed } from "../toast";

type Course = Pick<TeacherCourse, "id" | "name" | "academicYear" | "aiPolicy">;
/** `isPractice` is the contract's practice-assignment flag (WEB-1901); the server stores it and returns it, no grade field exists for it. */
type PracticeBody = NonNullable<ReturnType<typeof assignmentBody>> & { isPractice?: true; documentKind?: DocumentKind };
type Publish = (courseId: string, body: PracticeBody, requestKey: string) => Promise<AssignmentCreation>;
type LoadGroups = (courseId: string) => Promise<GroupsRead>;
type SaveRubric = (assignmentId: string, rubric: Rubric) => Promise<SaveOutcome>;
type SaveQuestion = (assignmentId: string, question: string) => Promise<QuestionOutcome>;
type SaveTemplate = (assignmentId: string, use: boolean) => Promise<TemplateOutcome>;
const loadOutlineDefault: LoadOutline = (workType) => readOutline(createApi() as Call, workType);
type ApplyRules = (assignmentId: string, choices: RuleChoices) => Promise<RuleName[]>;
type FormDraft = AssignmentDraft & { practice?: boolean; documentKind?: DocumentKind };
type Navigate = (href: string) => void;
const goTo: Navigate = (href) => window.location.assign(href);
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
 * NAS-19: after the server confirmed, and every follow-up switch was set, the teacher goes back to /nastavnik,
 * where the toast says the assignment is published (3200 ms). A follow-up that failed keeps this screen with its alert.
 */
export default function AssignmentForm({ course, publish = publishAssignment, cancelHref = "/nastavnik", doneHref = cancelHref, navigate = goTo, loadGroups, setRules, setRubricFor, setTemplateFor, setQuestionFor, loadOutline = loadOutlineDefault }: {
  course: Course; publish?: Publish; cancelHref?: string; doneHref?: string; navigate?: Navigate; loadGroups?: LoadGroups; setRules?: ApplyRules; setRubricFor?: SaveRubric;
  setTemplateFor?: SaveTemplate; setQuestionFor?: SaveQuestion; loadOutline?: LoadOutline;
}) {
  const request = useRef<{ body: string; key: string } | null>(null);
  const summary = useRef<HTMLParagraphElement>(null);
  const [draft, setDraft] = useState<FormDraft>(initialDraft);
  const [phase, setPhase] = useState<Phase>("form");
  const [errors, setErrors] = useState<FormErrors>({});
  const [uncertain, setUncertain] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [choices, setChoices] = useState<RuleChoices>(defaultChoices);
  const [groups, setGroups] = useState<GroupsRead | null>(null);
  const [ruleFailures, setRuleFailures] = useState<RuleName[]>([]);
  const [rubric, setRubric] = useState<Rubric>([]);
  const [rubricErrors, setRubricErrors] = useState<RubricErrors | undefined>(undefined);
  const [rubricOutcome, setRubricOutcome] = useState<SaveOutcome>("none");
  const [useTemplate, setUseTemplate] = useState(false);
  const [question, setQuestion] = useState("");
  const [questionOutcome, setQuestionOutcome] = useState<QuestionOutcome>("none");
  const [templateOutcome, setTemplateOutcome] = useState<TemplateOutcome>("none");
  const courseProhibits = course.aiPolicy === "prohibited";
  const set = <K extends keyof FormDraft>(key: K, value: FormDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const allowsHelp = !courseProhibits && draft.aiPurposes.length > 0;
  const summaryText = errorSummary(errors);

  useEffect(() => { if (summaryText) summary.current?.focus(); }, [summaryText]);

  // The course groups are read once per course; a failed read is shown, never taken for "no groups".
  useEffect(() => {
    let live = true;
    void (loadGroups ?? ((id: string) => readGroups(createApi() as Call, id)))(course.id).catch((): GroupsRead => ({ kind: "unavailable" })).then((read) => {
      if (!live) return;
      setGroups(read);
      // Every group is ticked at first: the assignment goes to all of them until the teacher narrows it.
      if (read.kind === "ready") setChoices((current) => ({ ...current, groupIds: read.groups.map((g) => g.id) }));
    });
    return () => { live = false; };
  }, [course.id, loadGroups]);

  function toReview() {
    const found = checkForm(draft);
    if (groupsMissing(groups, choices)) found.groups = f.errors.groups;
    const rubricFound = checkRubric(rubric);
    const rubricBad = rubricFound.list !== undefined || Object.keys(rubricFound.fields).length > 0;
    setRubricErrors(rubricBad ? rubricFound : undefined);
    setErrors(found);
    setFailure(rubricBad ? rubricFormHr.summary : null);
    const questionBad = checkQuestion(question) !== null;
    if (Object.keys(found).length === 0 && !rubricBad && !questionBad) setPhase("review");
  }

  async function confirm() {
    const body = assignmentBody(draft, course.aiPolicy);
    if (!body) { setPhase("form"); setFailure(a.errors.invalid); return; }
    const base = courseProhibits || body.aiPurposes.length === 0 ? body : { ...body, aiPolicy: course.aiPolicy };
    const aiBody = withDocumentKind(withPractice({ ...base, ...bodyExtras({ ...choices, summaryOnly: choices.summaryOnly && allowsHelp }, groups?.kind === "ready" ? groups.groups.length : null) }, draft), draft);
    const serialized = JSON.stringify(aiBody);
    // One retry key per body, so a repeated click after an unclear reply cannot create a second assignment.
    if (request.current?.body !== serialized) request.current = { body: serialized, key: crypto.randomUUID() };
    setFailure(null);
    setPhase("publishing");
    // The toast only after the server confirmed (B-6, decision 2164): `confirmed` is set by `toastWhenConfirmed` alone.
    let confirmed = false;
    const { result, ...outcome } = await toastWhenConfirmed(async () => {
      const answer = await publish(course.id, aiBody, request.current!.key);
      return { ...publishOutcome(answer), result: answer };
    }, () => { confirmed = true; }, publishHr.published);
    setUncertain(isUncertain(result));
    if (outcome.ok) {
      // Withdrawal and the declaration are switches of the new assignment: set after the create answer, each by its route.
      const id = result.kind === "available" ? result.id : null;
      const rules = id === null ? [] : await (setRules ?? ((assignmentId, picked) => applyRules(createApi() as Call, assignmentId, picked)))(id, choices).catch((): RuleName[] => ["late", "withdrawal", "declaration"]);
      const rubricDone: SaveOutcome = id === null ? "none" : await (setRubricFor ?? ((assignmentId, picked) => saveRubric(createApi() as Call, assignmentId, picked)))(id, rubric).catch((): SaveOutcome => "failed");
      const templateDone: TemplateOutcome = id === null ? "none" : await (setTemplateFor ?? ((assignmentId, use) => saveTemplate(createApi() as Call, assignmentId, use)))(id, useTemplate).catch((): TemplateOutcome => "failed");
      const questionDone: QuestionOutcome = id === null ? "none" : await (setQuestionFor ?? ((assignmentId, text) => saveQuestion(createApi() as Call, assignmentId, text, { skipEmpty: true })))(id, question).catch((): QuestionOutcome => "failed");
      setRuleFailures(rules);
      setRubricOutcome(rubricDone);
      setTemplateOutcome(templateDone);
      setQuestionOutcome(questionDone);
      const settled = (o: string) => o === "saved" || o === "none";
      const allSet = rules.length === 0 && settled(rubricDone) && settled(templateDone) && settled(questionDone);
      // Back to the courses, whose toast region says it; without session storage the confirmation stays here.
      if (confirmed && allSet && handOverPublished()) { navigate(doneHref); return; }
      setPhase("published");
    }
    else { setFailure(outcome.error ?? a.errors.unavailable); setPhase("review"); }
  }

  const heading = <p className="lede">{f.intro}</p>;

  if (phase === "published") {
    return (
      <section aria-label={`${course.name} · ${course.academicYear}`} className="card">
        <PublishDone />
        {rubricOutcome !== "saved" && rubricOutcome !== "none" && <p className="note" role="alert">{rubricFormHr.failed[rubricOutcome]}</p>}
        {questionOutcome !== "saved" && questionOutcome !== "none" && <p className="note" role="alert">{questionHr.failed[questionOutcome]}</p>}
        {templateOutcome !== "saved" && templateOutcome !== "none" && <p className="note" role="alert">{templateFieldHr.failed[templateOutcome]}</p>}
        {ruleFailures.map((name) => <p key={name} className="note" role="alert">{f.submitRules.failed[name]}</p>)}
      </section>
    );
  }

  if (phase === "publishing") {
    return <section className="card" aria-busy="true" aria-label={`${course.name} · ${course.academicYear}`}><p role="status" className="note">{publishHr.pending}</p></section>;
  }

  if (phase === "review") {
    const range = wordRangeHr({ min: draft.wordMin.trim() ? Number(draft.wordMin) : null, max: draft.wordMax.trim() ? Number(draft.wordMax) : null });
    const everyGroup = groups?.kind === "ready" ? groups.groups : [];
    const groupsText = everyGroup.length > 0 && (choices.groupIds ?? []).length < everyGroup.length
      ? everyGroup.filter((g) => choices.groupIds?.includes(g.id)).map((g) => g.name).join(", ")
      : f.values.groupsAll;
    const rows = [
      { id: "course", label: f.labels.course, value: course.name },
      { id: "kind", label: f.labels.kind, value: draft.practice === true ? f.values.practice : f.values.regular },
      { id: "documentKind", label: f.labels.documentKind, value: documentKindHr.options[kindOf(draft.documentKind)] },
      { id: "title", label: f.labels.title, value: draft.title.trim() },
      { id: "workType", label: f.labels.workType, value: a.workTypes[draft.workType as "seminar_paper" | "essay"] },
      { id: "opens", label: f.labels.opens, value: formatDateTimeHr(draft.opensAt) },
      { id: "due", label: f.labels.due, value: formatDateTimeHr(draft.dueAt) },
      ...(range ? [{ id: "words", label: f.labels.words, value: range }] : []),
      { id: "groups", label: f.labels.groups, value: groupsText },
      { id: "ai", label: f.labels.ai, value: !allowsHelp ? f.values.aiNone : choices.summaryOnly ? f.values.aiSummary : f.values.aiCourse },
      { id: "tools", label: f.labels.tools, value: choices.externalTools ? f.values.toolsYes : f.values.toolsNo },
      { id: "rubric", label: rubricFormHr.reviewLabel, value: rubric.length > 0 ? rubricFormHr.review(rubric.length) : rubricFormHr.none },
      { id: "template", label: templateFieldHr.reviewLabel, value: useTemplate ? templateFieldHr.reviewOn : templateFieldHr.reviewOff },
      { id: "question", label: questionHr.reviewLabel, value: normalizeQuestion(question) ?? questionHr.reviewNone },
      { id: "late", label: f.labels.late, value: choices.lateAllowed ? f.values.lateOn : f.values.lateOff },
      { id: "withdrawal", label: f.labels.withdrawal, value: choices.withdrawal ? f.values.withdrawalOn : f.values.withdrawalOff },
      { id: "declaration", label: f.labels.declaration, value: choices.declarationRequired ? f.values.declarationOn : f.values.declarationOff },
    ];
    return (
      <>
        <p className="lede">{f.reviewIntro}</p>
        {uncertain && <CheckListLink courseId={course.id} title={draft.title.trim()} />}
        <section className="card" aria-labelledby="po-h2">
          <h2 id="po-h2">{f.reviewHeading}</h2>
          <SummaryList rows={rows} />
          <p className="note">{seesLine(choices)}</p>
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
  const summaryOnly = choices.summaryOnly && allowsHelp;
  const aiValue = !allowsHelp ? "none" : summaryOnly ? "summary" : "course";
  const toggleGroup = (id: string, checked: boolean) => setChoices((current) => {
    const ticked = new Set(current.groupIds ?? []);
    if (checked) ticked.add(id); else ticked.delete(id);
    return { ...current, groupIds: groups?.kind === "ready" ? groups.groups.map((g) => g.id).filter((g) => ticked.has(g)) : null };
  });
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
          <DocumentKindField value={kindOf(draft.documentKind)} onChange={(value) => set("documentKind", value)} />
          <PracticeField checked={draft.practice === true} onChange={(value) => set("practice", value)} />
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
          {groups === null ? <p className="meta" role="status">{f.groups.loading}</p>
            : groups.kind === "unavailable" ? <p className="meta" role="status">{f.groups.unavailable}</p>
            : groups.groups.length === 0 ? <p className="meta">{f.groups.none}</p>
            : (
              <>
                <OptionGroup legend={f.groups.legend} name="groups" kind="checkbox" value={choices.groupIds ?? []}
                  options={groups.groups.map((g) => ({ value: g.id, label: g.name }))} onChange={toggleGroup} />
                {errors.groups ? <p className="err" role="alert">{errors.groups}</p> : <p className="meta">{f.groups.hint}</p>}
              </>
            )}
        </Section>

        <Section id="zs-3" title={f.sections.rules}>
          <p className="note">{f.rules.note}</p>
          <OptionGroup legend={f.rules.aiLegend} name="ai" value={aiValue}
            options={[
              ...(courseProhibits ? [] : [{ value: "course", label: f.rules.aiCourse }, { value: "summary", label: f.rules.aiSummary }]),
              { value: "none", label: f.rules.aiNone },
            ]}
            onChange={(value) => {
              set("aiPurposes", value === "course" ? [...AI_PURPOSES] : value === "summary" ? ["literature_search"] : []);
              setChoices((current) => ({ ...current, summaryOnly: value === "summary" }));
            }} />
          {courseProhibits || summaryOnly ? <p className="meta">{courseProhibits ? f.rules.courseProhibits : f.rules.aiSummaryHint}</p> : null}
          <OptionGroup legend={f.rules.toolsLegend} name="tools" value={choices.externalTools ? "yes" : "no"}
            options={[{ value: "yes", label: f.rules.toolsYes }, { value: "no", label: f.rules.toolsNo }]}
            onChange={(value) => setChoices((current) => ({ ...current, externalTools: value === "yes" }))} />
          <p className="meta">{f.rules.toolsHint}</p>
          <ImportAllowedField value={draft.importAllowed === true} onChange={(value) => set("importAllowed", value)} />
          <QuestionField value={question} onChange={setQuestion} />
          <p className="meta">{f.rules.seen}</p>
        </Section>

        <Section id="zs-4" title={f.sections.recorded}>
          <p className="note">{f.recorded.note}</p>
          <ul className="facts">{f.recorded.items.map((text) => <li key={text}>{text}</li>)}</ul>
          <p className="note">{f.recorded.scope}</p>
        </Section>

        <Section id="zs-5" title={f.sections.submitRules}>
          <p className="note">{f.submitRules.note}</p>
          <SubmissionRules value={choices} onChange={(next) => setChoices((current) => ({ ...current, ...next }))} />
        </Section>

        <RubricField value={rubric} onChange={setRubric} errors={rubricErrors} />

        <TemplateField value={useTemplate} onChange={setUseTemplate} workType={draft.workType} load={loadOutline} />

        <p className="meta">{f.submitHint}</p>
        <ActionRow>
          <Button type="button" onClick={toReview}>{f.review}</Button>
          <a className="btn secondary" href={cancelHref}>{f.cancel}</a>
        </ActionRow>
      </div>
    </>
  );
}
