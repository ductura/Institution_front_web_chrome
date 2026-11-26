"use client";

import { Button, Checkbox, DataTable, Select, TextArea, TextField, type DataTableColumn } from "@ductura/ui";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { questionnairePort, type Failure, type QuestionnairePort } from "./port";
import {
  KINDS, MAX_QUESTIONS, answersOf, bodyOf, draftOf, emptyDraft, emptyQuestion, nextState, takesManualEntry,
  type Draft, type DraftQuestion, type Kind, type ListItem, type Problem, type Question, type Questionnaire, type SheetInput,
} from "./model";
import { questionnaireMessages as text } from "./messages.hr";

type Mode =
  | { kind: "list" }
  | { kind: "edit"; id: string | null; draft: Draft }
  | { kind: "manual"; questionnaire: Questionnaire };
type Feedback = { error: boolean; label: string } | null;

const failureText = (kind: Failure): string =>
  kind === "signedOut" ? text.signedOut : kind === "notFound" ? text.notFound : text.unavailable;

/** The form of one draft: title and questions, nothing is sent until "Spremi upitnik". */
export function DraftForm({ draft, onChange, problem, busy }: {
  draft: Draft; onChange: (next: Draft) => void; busy: boolean;
  problem: { problem: Problem; index: number | null } | null;
}) {
  const setQuestion = (index: number, patch: Partial<DraftQuestion>) =>
    onChange({ ...draft, questions: draft.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) });
  const here = (p: Problem, index: number | null) => (problem?.problem === p && problem.index === index ? text.problem[p] : undefined);
  return (
    <div data-testid="questionnaire-form">
      <TextField label={text.fieldTitle} value={draft.title} maxLength={400} disabled={busy}
        error={here("title", null)} onChange={(e) => onChange({ ...draft, title: e.currentTarget.value })} />
      {problem?.problem === "count" && <p role="alert">{text.problem.count}</p>}
      {draft.questions.map((q, index) => (
        <fieldset key={index} data-question={index + 1}>
          <legend>{text.questionHeading(index + 1)}</legend>
          <Select label={text.fieldKind} value={q.kind} disabled={busy}
            options={KINDS.map((kind) => ({ value: kind, label: text.kinds[kind] }))}
            onChange={(e) => setQuestion(index, { kind: e.currentTarget.value as Kind })} />
          <TextArea label={text.fieldText} value={q.text} rows={2} maxLength={1000} disabled={busy}
            error={here("text", index)} onChange={(e) => setQuestion(index, { text: e.currentTarget.value })} />
          {(q.kind === "single" || q.kind === "multiple") && (
            <TextArea label={text.fieldOptions} hint={text.fieldOptionsHint} value={q.options} rows={4} disabled={busy}
              error={here("options", index)} onChange={(e) => setQuestion(index, { options: e.currentTarget.value })} />
          )}
          {q.kind === "scale" && (
            <>
              <TextField label={text.fieldScaleMin} inputMode="numeric" value={q.scaleMin} disabled={busy}
                onChange={(e) => setQuestion(index, { scaleMin: e.currentTarget.value })} />
              <TextField label={text.fieldScaleMax} inputMode="numeric" value={q.scaleMax} disabled={busy}
                error={here("scale", index)} onChange={(e) => setQuestion(index, { scaleMax: e.currentTarget.value })} />
            </>
          )}
          {draft.questions.length > 1 && (
            <Button type="button" tone="quiet" disabled={busy} aria-label={text.removeQuestion(index + 1)}
              onClick={() => onChange({ ...draft, questions: draft.questions.filter((_, i) => i !== index) })}>
              {text.removeQuestion(index + 1)}
            </Button>
          )}
        </fieldset>
      ))}
      <Button type="button" tone="quiet" disabled={busy || draft.questions.length >= MAX_QUESTIONS}
        onClick={() => onChange({ ...draft, questions: [...draft.questions, emptyQuestion()] })}>{text.addQuestion}</Button>
    </div>
  );
}

function SheetField({ question, value, onChange, error, busy }: {
  question: Question; value: SheetInput | undefined; onChange: (next: SheetInput) => void; error: boolean; busy: boolean;
}) {
  const label = `${question.order}. ${question.text}`;
  const message = error ? text.manualProblem.value : undefined;
  if (question.kind === "single") {
    return <Select label={label} value={typeof value === "string" ? value : ""} placeholder={text.manualPick} disabled={busy} error={message}
      options={(question.options ?? []).map((o) => ({ value: o.code, label: o.label }))} onChange={(e) => onChange(e.currentTarget.value)} />;
  }
  if (question.kind === "multiple") {
    const chosen = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend>{label}</legend>
        {(question.options ?? []).map((o) => (
          <Checkbox key={o.code} label={o.label} checked={chosen.includes(o.code)} disabled={busy}
            onChange={(e) => onChange(e.currentTarget.checked ? [...chosen, o.code] : chosen.filter((c) => c !== o.code))} />
        ))}
        {message && <p role="alert">{message}</p>}
      </fieldset>
    );
  }
  if (question.kind === "text") {
    return <TextArea label={label} rows={3} value={typeof value === "string" ? value : ""} disabled={busy} error={message}
      onChange={(e) => onChange(e.currentTarget.value)} />;
  }
  const hint = question.kind === "scale" && question.scale ? text.manualScaleHint(question.scale.min, question.scale.max) : text.manualNumberHint;
  return <TextField label={label} hint={hint} inputMode="decimal" value={typeof value === "string" ? value : ""} disabled={busy} error={message}
    onChange={(e) => onChange(e.currentTarget.value)} />;
}

/** One paper sheet: the answers go without a name; an empty field is not answered. */
export function SheetForm({ questionnaire, onSubmit, busy, notice }: {
  questionnaire: Questionnaire; busy: boolean; notice: Feedback;
  onSubmit: (answers: ReturnType<typeof answersOf> & { ok: true }) => void;
}) {
  const [inputs, setInputs] = useState<Record<string, SheetInput | undefined>>({});
  const [check, setCheck] = useState<ReturnType<typeof answersOf> | null>(null);
  const questions = useMemo(() => [...questionnaire.questions].sort((a, b) => a.order - b.order), [questionnaire]);
  const bad = check && !check.ok ? check.bad : [];
  return (
    <div data-testid="questionnaire-sheet">
      <p>{text.manualNote}</p>
      {questions.map((q) => (
        <SheetField key={q.id} question={q} value={inputs[q.id]} busy={busy} error={bad.includes(q.id)}
          onChange={(next) => setInputs({ ...inputs, [q.id]: next })} />
      ))}
      {check && !check.ok && check.reason === "none" && <p role="alert">{text.manualProblem.none}</p>}
      {notice && <p role={notice.error ? "alert" : "status"}>{notice.label}</p>}
      <Button type="button" disabled={busy} onClick={() => {
        const next = answersOf(questions, inputs);
        setCheck(next);
        if (next.ok) { onSubmit(next); }
      }}>{text.manualSubmit}</Button>
      <Button type="button" tone="quiet" disabled={busy} onClick={() => { setInputs({}); setCheck(null); }}>{text.manualAnother}</Button>
    </div>
  );
}

export function QuestionnairePanel({ courseId, courseName, port, onSignedOut }: {
  courseId: string; courseName: string; port: QuestionnairePort; onSignedOut: () => void;
}) {
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [confirm, setConfirm] = useState<{ item: ListItem; to: "open" | "closed" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [problem, setProblem] = useState<{ problem: Problem; index: number | null } | null>(null);
  const [sheetNotice, setSheetNotice] = useState<Feedback>(null);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);

  async function reload(): Promise<boolean> {
    const result = await port.list(courseId);
    if (result.kind === "ready") { setItems(result.value); setFailure(null); return true; }
    setFailure(result.kind);
    if (result.kind === "signedOut") onSignedOut();
    return false;
  }

  useEffect(() => {
    let active = true;
    setItems(null);
    setFailure(null);
    void port.list(courseId).then((result) => {
      if (!active) return;
      if (result.kind === "ready") setItems(result.value);
      else { setFailure(result.kind); if (result.kind === "signedOut") onSignedOut(); }
    });
    return () => { active = false; };
  }, [port, courseId, attempt]);

  /** One server call at a time; the list is read again after it, so what is shown is what the server holds. */
  async function run(step: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFeedback(null);
    try { await step(); } finally { pending.current = false; setBusy(false); }
  }

  async function openForm(item: ListItem) {
    await run(async () => {
      const result = await port.read(item.id);
      if (result.kind !== "ready") { setFeedback({ error: true, label: failureText(result.kind) }); return; }
      setProblem(null);
      setSheetNotice(null);
      setMode({ kind: "edit", id: item.id, draft: draftOf(result.value) });
    });
  }

  async function openManual(item: ListItem) {
    await run(async () => {
      const result = await port.read(item.id);
      if (result.kind !== "ready") { setFeedback({ error: true, label: failureText(result.kind) }); return; }
      if (!takesManualEntry(result.value.state)) { setFeedback({ error: true, label: text.manualOpen }); return; }
      setSheetNotice(null);
      setMode({ kind: "manual", questionnaire: result.value });
    });
  }

  async function save() {
    if (mode.kind !== "edit") return;
    const checked = bodyOf(mode.draft);
    if (!checked.ok) { setProblem({ problem: checked.problem, index: checked.index }); return; }
    setProblem(null);
    const { id } = mode;
    await run(async () => {
      const result = id === null ? await port.create(courseId, checked.value) : await port.change(id, checked.value);
      if (result.kind !== "ready") {
        if (result.kind === "signedOut") onSignedOut();
        setFeedback({ error: true, label: result.kind === "invalid" || result.kind === "conflict" ? text.saveInvalid : result.kind === "notFound" ? text.notFound : result.kind === "signedOut" ? text.signedOut : text.saveUnavailable });
        return;
      }
      setMode({ kind: "list" });
      const read = await reload();
      setFeedback({ error: !read, label: read ? text.saved : text.savedUnreadable });
    });
  }

  async function changeState(item: ListItem, to: "open" | "closed") {
    setConfirm(null);
    await run(async () => {
      const result = await port.setState(item.id, to);
      if (result.kind === "signedOut") onSignedOut();
      const read = await reload();
      if (result.kind === "ready") setFeedback({ error: !read, label: read ? (to === "open" ? text.published : text.closed) : text.savedUnreadable });
      else setFeedback({ error: true, label: result.kind === "conflict" ? text.stateConflict : failureText(result.kind) });
    });
  }

  async function sendSheet(questionnaire: Questionnaire, answers: Parameters<QuestionnairePort["addSheet"]>[1]) {
    await run(async () => {
      const result = await port.addSheet(questionnaire.id, answers);
      if (result.kind === "ready") { setSheetNotice({ error: false, label: text.manualSaved }); void reload(); }
      else {
        if (result.kind === "signedOut") onSignedOut();
        setSheetNotice({ error: true, label: result.kind === "invalid" || result.kind === "conflict" ? text.manualConflict : failureText(result.kind) });
      }
    });
  }

  const columns: DataTableColumn<ListItem>[] = [
    { id: "title", header: text.colTitle, rowHeader: true, cell: (row) => row.title },
    { id: "state", header: text.colState, cell: (row) => text.state[row.state] },
    { id: "created", header: text.colCreated, cell: (row) => row.createdOn },
    { id: "questions", header: text.colQuestions, cell: (row) => row.questionCount },
    { id: "responses", header: text.colResponses, cell: (row) => row.responseCount },
    {
      id: "actions", header: text.colActions,
      cell: (row) => {
        const to = nextState(row.state);
        return (
          <>
            {row.state === "draft" && <Button type="button" tone="quiet" disabled={busy} aria-label={text.actionFor(text.edit, row.title)} onClick={() => void openForm(row)}>{text.edit}</Button>}
            {to !== null && <Button type="button" tone="quiet" disabled={busy} aria-label={text.actionFor(to === "open" ? text.publish : text.close, row.title)}
              onClick={() => setConfirm({ item: row, to })}>{to === "open" ? text.publish : text.close}</Button>}
            {takesManualEntry(row.state) && <Button type="button" tone="quiet" disabled={busy} aria-label={text.actionFor(text.manual, row.title)} onClick={() => void openManual(row)}>{text.manual}</Button>}
          </>
        );
      },
    },
  ];

  if (mode.kind === "edit") {
    return (
      <div>
        <h3>{mode.id === null ? text.formTitleNew : text.formTitleEdit}</h3>
        {busy && <p role="status">{text.saving}</p>}
        {feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.label}</p>}
        <DraftForm draft={mode.draft} busy={busy} problem={problem} onChange={(draft) => setMode({ ...mode, draft })} />
        <Button type="button" disabled={busy} onClick={() => void save()}>{text.save}</Button>
        <Button type="button" tone="quiet" disabled={busy} onClick={() => { setMode({ kind: "list" }); setFeedback(null); }}>{text.discard}</Button>
      </div>
    );
  }
  if (mode.kind === "manual") {
    return (
      <div>
        <h3>{text.manualTitle(mode.questionnaire.title)}</h3>
        {busy && <p role="status">{text.saving}</p>}
        <SheetForm key={sheetNotice?.label ?? "sheet"} questionnaire={mode.questionnaire} busy={busy} notice={sheetNotice}
          onSubmit={(checked) => void sendSheet(mode.questionnaire, checked.answers)} />
        <Button type="button" tone="quiet" disabled={busy} onClick={() => { setMode({ kind: "list" }); setFeedback(null); }}>{text.close2}</Button>
      </div>
    );
  }
  return (
    <div data-testid="questionnaires" data-state={items === null && failure === null ? "loading" : failure ?? "ready"}>
      <p>{text.lead}</p>
      {busy && <p role="status">{text.saving}</p>}
      {feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.label}</p>}
      {confirm && (
        <div role="alertdialog" aria-label={confirm.to === "open" ? text.publish : text.close}>
          <p>{confirm.to === "open" ? text.confirmPublish(confirm.item.title) : text.confirmClose(confirm.item.title)}</p>
          <Button type="button" disabled={busy} onClick={() => void changeState(confirm.item, confirm.to)}>{text.confirm}</Button>
          <Button type="button" tone="quiet" onClick={() => setConfirm(null)}>{text.cancel}</Button>
        </div>
      )}
      {failure !== null
        ? <>
          <p role="alert">{failureText(failure)}</p>
          {failure !== "signedOut" && <Button type="button" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button>}
        </>
        : items === null ? <p role="status">{text.loading}</p>
        : <>
          <DataTable caption={text.caption(courseName)} columns={columns} rows={items} rowKey={(row) => row.id} empty={text.empty} />
          <Button type="button" disabled={busy} onClick={() => { setProblem(null); setFeedback(null); setMode({ kind: "edit", id: null, draft: emptyDraft() }); }}>{text.newQuestionnaire}</Button>
        </>}
    </div>
  );
}

/** Under each course card of "Moji kolegiji": the teacher's questionnaires of that course. */
export function CourseQuestionnaires({ courseId, courseName }: { courseId: string; courseName: string }) {
  const { base } = useHost();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const port = useMemo(() => questionnairePort(createApi()), []);
  return (
    <div>
      <Button type="button" tone="quiet" aria-label={`${text.title} · ${courseName}`} aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(!open)}>{text.title}</Button>
      <div id={panelId} hidden={!open}>
        {open && <QuestionnairePanel courseId={courseId} courseName={courseName} port={port}
          onSignedOut={() => goToSignIn(appHref(base, "/nastavnik"))} />}
      </div>
    </div>
  );
}
