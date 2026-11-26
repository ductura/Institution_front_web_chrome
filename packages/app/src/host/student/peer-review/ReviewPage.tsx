"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Dialog, TextArea } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { Marks, notAnswer } from "./Frame";
import { peerReviewText as t } from "./messages.hr";
import { buildReview, EMPTY_DRAFT, grouped, MAX_TEXT, type Draft, type TextError } from "./model";
import { readWork, sendReview, type Read, type SendOutcome, type WorkView } from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();

const FAILURE: Readonly<Record<Exclude<SendOutcome["kind"], "done" | "signedOut">, string>> = {
  closed: t.errors.closed, alreadyReviewed: t.errors.alreadyReviewed, notFound: t.errors.notFound, invalid: t.errors.invalid, unknown: t.errors.unknown,
};

/**
 * Student: "Recenzija rada" (WEB-V19-RECENZIJA-STUDENT, over student.peer-review-work.get and
 * student.peer-review.post). The anonymised text of the allocated work and one field per rubric of the teacher,
 * and an optional general comment. The page has no field, link or text that leads to the author. A review is sent
 * once, after a confirmation, and cannot be changed (the server records it append-only); a note of success
 * follows only the server's answer. On an unknown outcome the draft stays and the student is told to check the
 * list before trying again. `call` is for tests.
 */
export default function ReviewPage({ assignmentId, taskId, call = defaultCall }: { assignmentId: string; taskId: string; call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}/recenzija/rad/${encodeURIComponent(taskId)}`);
  const list = appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}/recenzija`);
  const [read, setRead] = useState<Read<WorkView> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [fields, setFields] = useState<Readonly<Record<string, TextError>>>({});
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let live = true;
    void readWork(call(), taskId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      setRead(result);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, taskId]);
  const retry = useCallback(() => { setRead(null); setAttempt((n) => n + 1); }, []);

  const back = <p><a href={list}><span aria-hidden="true">← </span>{t.backToList}</a></p>;
  const head = <header><h1>{t.work.title}</h1><p>{t.work.lead}</p></header>;
  const pending = notAnswer(read, t.work.title, retry);
  if (pending !== null || read === null || read.kind !== "ok") return <div className="page">{back}{head}{pending}</div>;
  const work = read.view;

  function ask() {
    setNote(null);
    const built = buildReview(work.rubrics, draft);
    if (!built.ok) {
      setFields(built.fields);
      setNote({ tone: "alert", text: built.error === "empty" ? t.errors.empty : t.errors.invalid });
      return;
    }
    setFields({});
    setConfirming(true);
  }

  async function send() {
    if (busy) return;
    const built = buildReview(work.rubrics, draft);
    if (!built.ok) { setConfirming(false); return; }
    setBusy(true);
    const outcome = await sendReview(call(), taskId, built.body);
    setBusy(false);
    setConfirming(false);
    if (outcome.kind === "signedOut") { goToSignIn(here); return; }
    if (outcome.kind === "done") { setSent(true); setNote({ tone: "status", text: t.work.sent }); return; }
    setNote({ tone: "alert", text: FAILURE[outcome.kind] });
  }

  const errorOf = (key: string): string | undefined => {
    const e = fields[key];
    return e === undefined ? undefined : t.errors[e];
  };

  return (
    <div className="page">
      {back}{head}
      <Marks />
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <Card level={2} title={t.work.textTitle}>
        <div data-testid="anonymous-work">
          {work.document.blocks.length === 0 && <p>{t.work.emptyDocument}</p>}
          {grouped(work.document.blocks).map((item, i) => {
            if (item.kind === "list") return <ul key={i}>{item.items.map((text, j) => <li key={j}>{text}</li>)}</ul>;
            const { kind, text } = item.block;
            if (kind === "heading") return <h3 key={i}>{text}</h3>;
            if (kind === "quote") return <blockquote key={i}><p>{text}</p></blockquote>;
            return <p key={i}>{text}</p>;
          })}
        </div>
      </Card>
      {sent ? (
        <p><a className="btn" href={list} data-testid="back-to-list">{t.backToList}</a></p>
      ) : (
        <Card level={2} title={t.work.formTitle}>
          <form noValidate onSubmit={(event) => { event.preventDefault(); ask(); }}>
            {work.rubrics.map((rubric) => (
              <TextArea key={rubric.key} label={rubric.label} hint={t.work.rubricHint} busy={busy} maxLength={MAX_TEXT * 2} value={draft.byRubric[rubric.key] ?? ""}
                error={errorOf(rubric.key)} onChange={(e) => setDraft({ ...draft, byRubric: { ...draft.byRubric, [rubric.key]: e.target.value } })} />
            ))}
            <TextArea label={t.work.general} hint={t.work.generalHint} busy={busy} maxLength={MAX_TEXT * 2} value={draft.general}
              error={errorOf("general")} onChange={(e) => setDraft({ ...draft, general: e.target.value })} />
            <p><Button type="submit" busy={busy} disabled={busy}>{busy ? t.work.sending : t.work.send}</Button></p>
          </form>
          <Dialog open={confirming} title={t.work.confirmTitle} onClose={() => { if (!busy) setConfirming(false); }} dismissible={!busy}
            actions={(
              <>
                <Button tone="quiet" disabled={busy} onClick={() => setConfirming(false)}>{t.work.confirmNo}</Button>
                <Button busy={busy} disabled={busy} onClick={() => void send()}>{busy ? t.work.sending : t.work.confirmYes}</Button>
              </>
            )}>
            <p>{t.work.confirmBody}</p>
          </Dialog>
        </Card>
      )}
    </div>
  );
}
