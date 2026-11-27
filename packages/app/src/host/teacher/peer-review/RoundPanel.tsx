"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, Dialog, RouteLoading, Select, TextField } from "@ductura/ui";

import { LoadAlert } from "../../states/States";

import type { createApi } from "@/client/api";
import { teacherPeerReviewText as t } from "./messages.hr";
import { checkRound, draftOf, isSaved, mayAllocate, mayEdit, nextKey, MAX_LABEL, MAX_RUBRICS, PER_STUDENT, type RoundDraft, type RoundError } from "./model";
import { allocate, putRound, readRound, type Read, type RoundView, type Write } from "./read";

type Api = ReturnType<typeof createApi>;
type Note = { tone: "status" | "alert"; text: string };

const SAVE_FAILURE: Readonly<Record<Exclude<Write["kind"], "done" | "signedOut" | "tooFew" | "conflict">, string>> = {
  already: t.round.already, notFound: t.round.notFound, invalid: t.round.invalid, unknown: t.round.unknown,
};
const ALLOCATE_FAILURE: Readonly<Record<Exclude<Write["kind"], "done" | "signedOut" | "invalid" | "conflict">, string>> = {
  already: t.allocate.already, notFound: t.allocate.notFound, tooFew: t.allocate.tooFew, unknown: t.allocate.unknown,
};

/**
 * WEB-V19-RECENZIJA-NASTAVNIK: "Postavka kruga" of one assignment (peer-review.round.get/put) and the one button
 * that allocates the reviews (peer-review.allocate.post). The checks are the server's, repeated to spare a round
 * trip; a note of success follows only the server's answer and the form is locked while it is being sent. The
 * round is read again after any answer, and `onChanged` tells the page whose overview depends on it. Once the
 * reviews are allocated the form is read-only (the server refuses a change then). A standalone component,
 * mounted by OverviewPage.
 */
export function RoundPanel({ assignmentId, call, onSignedOut, onDenied, onChanged }: {
  assignmentId: string; call: () => Api; onSignedOut: () => void; onDenied: () => void; onChanged: () => void;
}) {
  const [read, setRead] = useState<Read<RoundView> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<RoundDraft | null>(null);
  const [error, setError] = useState<{ field: string; error: RoundError } | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const no = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    void readRound(call(), assignmentId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") onSignedOut();
      if (result.kind === "denied") onDenied();
      setRead(result);
      if (result.kind === "ok") setDraft(draftOf(result.value.round));
    });
    return () => { live = false; };
    // `call` and `onSignedOut` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, assignmentId]);

  /** The form stays locked until the round is read again, so a late answer cannot overwrite a newer edit. */
  async function refresh(keepDraft = false) {
    const fresh = await readRound(call(), assignmentId);
    setBusy(false);
    if (fresh.kind === "signedOut") { onSignedOut(); return; }
    setRead(fresh);
    if (fresh.kind === "ok" && !(keepDraft && mayEdit(fresh.value.round))) setDraft(draftOf(fresh.value.round));
    onChanged();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || draft === null) return;
    setNote(null);
    const checked = checkRound(draft, read !== null && read.kind === "ok" ? read.value.round : null);
    if (!checked.ok) { setError({ field: checked.field, error: checked.error }); return; }
    setError(null);
    setBusy(true);
    const outcome = await putRound(call(), assignmentId, checked.value);
    if (outcome.kind === "signedOut") { setBusy(false); onSignedOut(); return; }
    if (outcome.kind === "done") setNote({ tone: "status", text: t.round.saved });
    else setNote({ tone: "alert", text: outcome.kind === "tooFew" || outcome.kind === "conflict" ? t.round.invalid : SAVE_FAILURE[outcome.kind] });
    // A save that did not succeed keeps what the teacher typed (while the round still takes it), so a retry is possible.
    await refresh(outcome.kind !== "done");
  }

  async function doAllocate() {
    setConfirm(false);
    if (busy) return;
    setNote(null);
    setBusy(true);
    const outcome = await allocate(call(), assignmentId);
    if (outcome.kind === "signedOut") { setBusy(false); onSignedOut(); return; }
    if (outcome.kind === "done") setNote({ tone: "status", text: t.allocate.done.replace("{n}", String(outcome.value)) });
    else setNote({ tone: "alert", text: outcome.kind === "invalid" || outcome.kind === "conflict" ? t.allocate.unknown : ALLOCATE_FAILURE[outcome.kind] });
    await refresh();
  }

  if (read === null || read.kind === "signedOut") return <Card level={2} title={t.round.title}><RouteLoading label={t.round.loading} /></Card>;
  if (read.kind === "denied") return null;
  if (read.kind !== "ok" || draft === null) {
    return (
      <Card level={2} title={t.round.title}>
        {read.kind === "unavailable"
          ? <LoadAlert body={t.round.unavailable} retry={{ label: t.retry, onRetry: () => { setRead(null); setAttempt((n) => n + 1); } }} />
          : <LoadAlert body={t.gone} />}
      </Card>
    );
  }
  const view = read.value;
  const editable = mayEdit(view.round);
  const fieldError = (field: string) => (error?.field === field ? t.round.errors[error.error] : undefined);
  const locked = busy || !editable;
  const setRubric = (index: number, label: string) => setDraft({ ...draft, rubrics: draft.rubrics.map((r, i) => (i === index ? { ...r, label } : r)) });
  return (
    <Card level={2} title={t.round.title}>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <p>{t.round.lead}</p>
      <p data-testid="round-state">{t.round.state[view.state]}</p>
      <p>{t.round.submittedWorks.replace("{n}", String(view.submittedWorks))} {t.round.minSubmissions.replace("{n}", String(view.minSubmissions))}</p>
      {!editable && <p data-testid="round-locked">{t.round.locked}</p>}
      <form onSubmit={(event) => void save(event)} noValidate>
        <TextField type="datetime-local" label={t.round.opensAt} hint={t.round.dateHint} disabled={locked} value={draft.opensAt}
          error={fieldError("opensAt")} onChange={(e) => setDraft({ ...draft, opensAt: e.target.value })} />
        <TextField type="datetime-local" label={t.round.dueAt} hint={t.round.dateHint} disabled={locked} value={draft.dueAt}
          error={fieldError("dueAt")} onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })} />
        <Select label={t.round.reviewsPerStudent} disabled={locked} value={draft.reviewsPerStudent} error={fieldError("reviewsPerStudent")}
          options={PER_STUDENT.map((n) => ({ value: String(n), label: String(n) }))} onChange={(e) => setDraft({ ...draft, reviewsPerStudent: e.target.value })} />
        <fieldset disabled={locked}>
          <legend>{t.round.rubrics}</legend>
          <p>{t.round.rubricHint}</p>
          {fieldError("rubrics") !== undefined && <p role="alert">{fieldError("rubrics")}</p>}
          {draft.rubrics.map((rubric, index) => (
            <div key={rubric.key} data-testid="rubric">
              <TextField label={t.round.rubricLabel.replace("{n}", String(index + 1))} value={rubric.label} maxLength={MAX_LABEL} onChange={(e) => setRubric(index, e.target.value)} />
              {draft.rubrics.length > 1 && (
                <Button type="button" tone="quiet" aria-label={t.round.removeRubric.replace("{n}", String(index + 1))}
                  onClick={() => setDraft({ ...draft, rubrics: draft.rubrics.filter((_, i) => i !== index) })}>{t.round.removeRubric.replace("{n}", String(index + 1))}</Button>
              )}
            </div>
          ))}
          {draft.rubrics.length < MAX_RUBRICS && (
            <p><Button type="button" tone="quiet" onClick={() => setDraft({ ...draft, rubrics: [...draft.rubrics, { key: nextKey(draft.rubrics), label: "" }] })}>{t.round.addRubric}</Button></p>
          )}
        </fieldset>
        {editable && <p><Button type="submit" busy={busy}>{busy ? t.round.saving : t.round.save}</Button></p>}
      </form>
      {view.round !== null && view.state === "not_allocated" && (
        <p>
          <Button tone="secondary" disabled={busy || !mayAllocate(view) || !isSaved(draft, view.round)} busy={busy} onClick={() => setConfirm(true)}>
            {busy ? t.allocate.working : t.allocate.button}
          </Button>
        </p>
      )}
      {view.round === null && <p>{t.allocate.needRound}</p>}
      {view.round !== null && view.state === "not_allocated" && !isSaved(draft, view.round) && <p data-testid="unsaved">{t.allocate.unsaved}</p>}
      <Dialog open={confirm} title={t.allocate.confirmTitle} onClose={() => setConfirm(false)} initialFocus={no}
        actions={<>
          <Button ref={no} tone="secondary" onClick={() => setConfirm(false)}>{t.allocate.confirmNo}</Button>
          <Button onClick={() => void doAllocate()}>{t.allocate.confirmYes}</Button>
        </>}>
        <p>{t.allocate.confirmBody}</p>
      </Dialog>
    </Card>
  );
}
