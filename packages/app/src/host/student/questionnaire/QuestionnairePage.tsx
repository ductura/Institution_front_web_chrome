"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card, OptionGroup, RouteLoading, Tag, TextArea, TextField } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { LoadAlert } from "../../states/States";
import { questionnaireText as t } from "./messages.hr";
import { buildSheet, emptyField, MAX_TEXT, scaleValues, type Fields } from "./model";
import { readForm, readList, sendSheet, type Form, type FormRead, type ListRead, type Row } from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();
type Note = { tone: "status" | "alert"; text: string };

/**
 * Student: "Upitnici" (WEB-V18-UPITNIK-ISPUNJAVANJE). The open questionnaires of the student's courses, the form of
 * one, and one sheet of answers. The notice that answers are not linked to the student's name is always on the
 * page. A note of success follows only the server's answer; loading, error and empty are three different states.
 * `call` is for tests.
 */
export default function QuestionnairePage({ call = defaultCall }: { call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, "/zadaci/upitnici");
  const [list, setList] = useState<ListRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let live = true;
    void readList(call()).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      setList(result);
    });
    return () => { live = false; };
    // `call` and `here` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  async function reconcile(): Promise<ListRead> {
    const result = await readList(call());
    if (result.kind === "signedOut") goToSignIn(here);
    // A failed re-read must not replace the list: that would drop the form and the answers typed into it.
    if (result.kind === "ok") setList(result);
    return result;
  }
  const back = <p><a href={appHref(base, "/zadaci")}><span aria-hidden="true">← </span>{t.back}</a></p>;
  const head = <header><h1>{t.title}</h1><p>{t.lead}</p><p role="note">{t.anonymityNotice}</p></header>;

  if (list === null || list.kind === "signedOut") return <div className="page">{back}{head}<RouteLoading label={t.loading} /></div>;
  if (list.kind === "unavailable") {
    return (
      <div className="page">{back}{head}
        <Card level={2} title={t.listTitle}>
          <LoadAlert body={t.unavailable} />
          <p><Button tone="quiet" onClick={reload}>{t.retry}</Button></p>
        </Card>
      </div>
    );
  }
  const rows = list.questionnaires;
  return (
    <div className="page">
      {back}{head}
      {note !== null && (note.tone === "alert" ? <LoadAlert body={note.text} /> : <p role="status">{note.text}</p>)}
      <Card level={2} title={t.listTitle}>
        {rows.length === 0 ? <><h3>{t.noQuestionnaires.title}</h3><p>{t.noQuestionnaires.body}</p></> : (
          <ul>
            {rows.map((row) => (
              <li key={row.id} data-testid="questionnaire">
                <strong>{row.title}</strong>{" "}
                {row.participated
                  ? <><Tag tone="accent">{t.filled}</Tag><br /><span>{t.filledHint}</span></>
                  : <Button tone="quiet" disabled={sending} aria-label={t.fillAria.replace("{title}", row.title)} onClick={() => { setNote(null); setOpenId(row.id); }}>{t.fill}</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {openId !== null && rows.some((r) => r.id === openId && !r.participated) && (
        <FormCard
          key={openId} id={openId} title={rows.find((r) => r.id === openId)!.title} call={call} here={here}
          onClose={() => setOpenId(null)} onBusy={setSending}
          onFinished={async (outcome) => {
            setOpenId(null);
            setNote(outcome === "saved" ? { tone: "status", text: t.saved } : outcome === "conflict" ? { tone: "alert", text: t.conflict }
              : outcome === "gone" ? { tone: "alert", text: t.gone } : { tone: "alert", text: t.unknown });
            await reconcile();
          }}
          onUnknown={async () => {
            // The sheet may have been kept: read again; the form stays open only while the server shows no sheet.
            const result = await reconcile();
            const kept = result.kind === "ok" && result.questionnaires.some((r: Row) => r.id === openId && r.participated);
            if (kept) { setOpenId(null); setNote({ tone: "status", text: t.saved }); }
            return kept;
          }}
        />
      )}
    </div>
  );
}

type Finish = "saved" | "conflict" | "gone";

function FormCard({ id, title, call, here, onClose, onBusy, onFinished, onUnknown }: {
  id: string; title: string; call: () => Api; here: string; onClose: () => void; onBusy: (busy: boolean) => void;
  onFinished: (outcome: Finish) => Promise<void>; onUnknown: () => Promise<boolean>;
}) {
  const [read, setRead] = useState<FormRead | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void readForm(call(), id).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      if (result.kind === "notFound") { void onFinished("gone"); return; }
      setRead(result);
    });
    return () => { live = false; };
    // `call`, `here` and `onFinished` are stable per visit; the attempt and the id are what ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, id]);

  const card = t.formTitle.replace("{title}", title);
  if (read === null || read.kind === "signedOut" || read.kind === "notFound") return <Card level={2} title={card}><RouteLoading label={t.loadingForm} /></Card>;
  if (read.kind === "unavailable") {
    return (
      <Card level={2} title={card}>
        <LoadAlert body={t.formUnavailable} />
        <p><Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>{" "}<Button tone="quiet" onClick={onClose}>{t.close}</Button></p>
      </Card>
    );
  }
  if (read.form.participated) {
    return <Card level={2} title={card}><p role="status">{t.filledHint}</p><p><Button tone="quiet" onClick={onClose}>{t.close}</Button></p></Card>;
  }
  return <Sheet form={read.form} card={card} call={call} here={here} onClose={onClose} onBusy={onBusy} onFinished={onFinished} onUnknown={onUnknown} />;
}

function Sheet({ form, card, call, here, onClose, onBusy, onFinished, onUnknown }: {
  form: Form; card: string; call: () => Api; here: string; onClose: () => void; onBusy: (busy: boolean) => void;
  onFinished: (outcome: Finish) => Promise<void>; onUnknown: () => Promise<boolean>;
}) {
  const [fields, setFields] = useState<Fields>(() => Object.fromEntries(form.questions.map((q) => [q.id, emptyField(q)])));
  const [error, setError] = useState<{ questionId: string | null; text: string } | null>(null);
  const [busy, setBusyState] = useState(false);
  // The page also locks its list while a sheet is on the way, so the finished request cannot close another form.
  const setBusy = (value: boolean) => { setBusyState(value); onBusy(value); };
  const questions = [...form.questions].sort((a, b) => a.order - b.order);
  const set = (qid: string, value: string | readonly string[]) => setFields((f) => ({ ...f, [qid]: value }));
  const errorOf = (qid: string) => (error?.questionId === qid ? error.text : undefined);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const built = buildSheet(form.questions, fields);
    if (!built.ok) {
      const text = built.error === "textTooLong" ? t.errors.textTooLong.replace("{max}", String(MAX_TEXT)) : t.errors[built.error];
      setError({ questionId: built.error === "none" ? null : built.questionId, text });
      return;
    }
    setError(null);
    setBusy(true);
    const outcome = await sendSheet(call(), form.id, { answers: built.answers });
    if (outcome.kind === "signedOut") { setBusy(false); goToSignIn(here); return; }
    if (outcome.kind === "saved") { await onFinished("saved"); setBusy(false); return; }
    if (outcome.kind === "conflict") { await onFinished("conflict"); setBusy(false); return; }
    if (outcome.kind === "notFound") { await onFinished("gone"); setBusy(false); return; }
    if (outcome.kind === "invalid") { setError({ questionId: null, text: t.invalid }); setBusy(false); return; }
    // Unknown: the page asks the server whether the sheet was kept before it lets the student send again.
    const kept = await onUnknown();
    if (!kept) { setError({ questionId: null, text: t.unknown }); setBusy(false); }
  }

  return (
    <Card level={2} title={card}>
      <form onSubmit={(event) => void send(event)} noValidate>
        <p>{t.optionalNote}</p>
        {error !== null && error.questionId === null && <LoadAlert body={error.text} />}
        {questions.map((q) => {
          const legend = t.questionOf.replace("{n}", String(q.order)).replace("{text}", q.text);
          const value = fields[q.id] ?? emptyField(q);
          const err = errorOf(q.id);
          const group = (kind: "radio" | "checkbox", options: readonly { value: string; label: string }[]) => (
            <OptionGroup
              legend={legend} name={`q-${q.id}`} kind={kind} options={options} value={value} disabled={busy}
              onChange={(v, checked) => {
                if (kind === "radio") set(q.id, v);
                else { const now = Array.isArray(value) ? value : []; set(q.id, checked ? [...now, v] : now.filter((c) => c !== v)); }
              }}
            />
          );
          return (
            <div key={q.id} data-testid="question">
              {q.kind === "single" && group("radio", (q.options ?? []).map((o) => ({ value: o.code, label: o.label })))}
              {q.kind === "multiple" && group("checkbox", (q.options ?? []).map((o) => ({ value: o.code, label: o.label })))}
              {q.kind === "scale" && group("radio", scaleValues(q).map((n) => ({ value: String(n), label: String(n) })))}
              {q.kind === "number" && (
                <TextField label={legend} hint={t.hintNumber} inputMode="decimal" busy={busy} error={err} value={typeof value === "string" ? value : ""} onChange={(e) => set(q.id, e.target.value)} />
              )}
              {q.kind === "text" && (
                <TextArea label={legend} hint={t.textHint.replace("{max}", String(MAX_TEXT))} busy={busy} error={err} value={typeof value === "string" ? value : ""} onChange={(e) => set(q.id, e.target.value)} />
              )}
              {q.kind === "scale" && q.scale !== null && <p>{t.hintScale.replace("{min}", String(q.scale.min)).replace("{max}", String(q.scale.max))}</p>}
              {q.kind === "single" && <p>{t.hintSingle}</p>}
              {q.kind === "multiple" && <p>{t.hintMultiple}</p>}
              {err !== undefined && q.kind !== "number" && q.kind !== "text" && <p role="alert">{err}</p>}
            </div>
          );
        })}
        <p><Button type="submit" busy={busy}>{busy ? t.submitting : t.submit}</Button>{" "}<Button tone="quiet" disabled={busy} onClick={onClose}>{t.close}</Button></p>
      </form>
    </Card>
  );
}
