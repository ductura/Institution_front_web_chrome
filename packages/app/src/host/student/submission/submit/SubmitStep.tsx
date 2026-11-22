"use client";

// WEB-2109 (PARITET Predaja E-10 / PD-3): step 4 in the host. Same server calls as
// src/components/student/Submission.tsx (evidence.open.post, submission.submit.post), now with the
// transport of "Provjeri stanje predaje" (readSubmittedWork), the extended deadline (C-15), the states
// of the prototype, aria-disabled instead of disabled, and a backdrop click that closes PD-3 (R-30).
import { Button, Dialog, Steps } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { browserTransport, createApi, goToSignIn } from "../../../../../../../src/client/api";
import { useOnline } from "../../../../../../../src/client/online-status";
import { readSubmissionState, submitWork, type LocalCall, type SubmitInput, type SubmitOutcome } from "../../../../../../../src/client/submission";
import { readConfirmed, useSessionTag } from "../../../../../../../src/components/predaja/Declaration";
import { confirmationKey } from "../../../../../../../src/components/predaja/flow";
import { oneAtATime, readWork, whileShown } from "../../../../../../../src/components/student/Submission";
import { Text, type WorkRead } from "../../../../../../../src/components/student/SubmissionView";
import { SERVER_PREFIX } from "../../../../../../../src/client/api";
import { appHref } from "../../../../../../../src/components/index";
import { useHost } from "../../../context";
import { submitText as t } from "./messages.hr";
import { dateOf, fill, nextOf, wordCount, type Answer, type Next, type SubmitStage } from "./model";

const OUTCOME_ID = "submission-outcome";
const WHY_ID = "submission-why";

/** The transport of student.submission.get: the route the host already reads (submitted-work-read.ts). */
const local: LocalCall = async (_id, { params }) => {
  const answer = await browserTransport(new URL(`${SERVER_PREFIX}student/assignments/${encodeURIComponent(params.assignmentId)}/submission`, globalThis.location.origin), {
    method: "GET", credentials: "include", redirect: "manual", cache: "no-store", headers: { accept: "application/json" },
  });
  if (answer.status === 200 && answer.headers.get("content-type")?.startsWith("application/json")) return { ok: true, status: 200, body: await answer.json() };
  return { ok: false, status: answer.status, code: "unavailable" };
};

/** A click on the backdrop (outside the dialog's box) closes it (R-30), unless a submission is on its way. */
function useBackdropClose(root: React.RefObject<HTMLDivElement | null>, active: boolean, onClose: () => void) {
  useEffect(() => {
    const dialog = root.current?.querySelector("dialog");
    if (!active || !dialog) return;
    const click = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) onClose();
    };
    dialog.addEventListener("click", click);
    return () => dialog.removeEventListener("click", click);
  });
}

export type SubmitStepProps = {
  readonly assignmentId: string;
  readonly title: string;
  readonly stage: SubmitStage;
  readonly dueAt: string | null;
};

export default function SubmitStep(props: SubmitStepProps) {
  return <Step key={props.assignmentId} {...props} />;
}

function Step({ assignmentId, title, stage, dueAt }: SubmitStepProps) {
  const router = useRouter();
  const { base } = useHost();
  const online = useOnline();
  const href = (path: string) => appHref(base, path);
  const root = useRef<HTMLDivElement>(null);
  const [work, setWork] = useState<WorkRead>({ kind: "loading" });
  const [confirmed, setConfirmed] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [next, setNext] = useState<Extract<Next, { go: null }> | null>(null);
  const idPath = `/rad/${encodeURIComponent(assignmentId)}`;
  const here = `${idPath}/predaja/slanje`;
  const send = useRef(oneAtATime((input: SubmitInput) => submitWork(input, { local }))).current;
  const ticket = useRef(0);
  const shown = useRef(false);

  const follow = useCallback((answer: Answer) => {
    const step = nextOf(answer);
    if (step.go === null) {
      setNext(step);
      requestAnimationFrame(() => document.getElementById(OUTCOME_ID)?.focus());
    } else if (step.go === "receipt") router.push(href(`${idPath}/predaja/potvrda`));
    else if (step.go === "notice") router.push(href(`/zadatak/${encodeURIComponent(assignmentId)}`));
    else goToSignIn(href(here));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, idPath, here, base, router]);

  const load = useCallback(async () => {
    const mine = ++ticket.current;
    setWork({ kind: "loading" });
    setNext(null);
    const read = await readWork(assignmentId);
    if (mine !== ticket.current) return;
    if (read.kind === "notice") router.push(href(`/zadatak/${encodeURIComponent(assignmentId)}`));
    else if (read.kind === "signIn") goToSignIn(href(here));
    else setWork(read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, here, base, router]);

  const tag = useSessionTag();
  useEffect(() => setConfirmed(tag !== null && readConfirmed(confirmationKey(tag, assignmentId))), [tag, assignmentId]);
  useEffect(() => { shown.current = true; return () => { shown.current = false; }; }, []);
  useEffect(() => { void load(); return () => { ticket.current += 1; }; }, [load]);

  const ready = work.kind === "ready" ? work : null;
  const submit = async () => {
    if (ready === null || !online || sending) return;
    setSending(true);
    const outcome: SubmitOutcome | null = await send({ assignmentId, documentId: ready.documentId, revision: ready.revision });
    whileShown(shown, (answer: SubmitOutcome) => { setSending(false); setDialog(false); follow(answer); })(outcome);
  };
  const check = async () => {
    if (checking) return;
    setChecking(true);
    const state = await readSubmissionState(local, assignmentId);
    whileShown(shown, (answer: Answer) => { setChecking(false); follow(answer); })({ kind: "check", state });
  };

  const canSend = ready !== null && confirmed && online && !sending && (next === null || next.retry);
  const why = !online ? t.offline : !confirmed ? t.declarationMissing : undefined;
  const words = ready === null ? 0 : wordCount(ready.nodes);
  const closeDialog = () => { if (!sending) setDialog(false); };
  useBackdropClose(root, dialog, closeDialog);
  const until = stage.kind === "extended" ? dateOf(stage.until) : null;

  return (
    <div className="page submission" ref={root}>
      <Steps currentStep={4} />
      <h1>{t.title}</h1>
      {stage.kind === "extended" && until && <p role="note"><strong>{fill(t.extendedTag, { until: until.date })}</strong> {fill(t.extendedNote, { until: until.date, time: until.time })}</p>}
      {stage.kind === "closed" && <p role="note">{fill(t.lateNote, { due: dateOf(stage.dueAt).date })}</p>}
      {stage.kind === "unavailable" && <p role="note">{t.stageUnavailable}</p>}
      {!online && <p role="status"><strong>{t.offlineTag}</strong> {t.offline}</p>}
      {work.kind === "loading" && <p role="status">{t.loading}</p>}
      {work.kind === "unavailable" && (
        <>
          <p role="alert">{t.loadError}</p>
          <p><Button tone="quiet" onClick={() => void load()}>{t.retry}</Button></p>
        </>
      )}
      {work.kind === "empty" && <p role="status">{t.empty}</p>}
      {ready !== null && (
        <section aria-labelledby="submission-facts">
          <h2 id="submission-facts">{t.textTitle} ({t.revision}: {ready.revision})</h2>
          <dl>
            <dt>{t.due}</dt><dd>{dueAt === null ? t.stageUnavailable : dateOf(stage.kind === "extended" ? stage.until : stage.kind === "closed" ? stage.dueAt : dueAt).date}</dd>
            <dt>{t.words}</dt><dd>{words}</dd>
            <dt>{t.conversations}</dt><dd>{t.conversationsUnavailable}</dd>
          </dl>
          <p>{t.timeNote}</p>
          <p>{t.serverNote}</p>
          <div className="manuscript" role="document" aria-label={t.textTitle}><Text nodes={ready.nodes} /></div>
        </section>
      )}
      {sending && <p role="status">{t.inProgress}</p>}
      {next !== null && (
        <div id={OUTCOME_ID} tabIndex={-1} role="alert">
          {next.title && <h2>{next.title}</h2>}
          {next.text.map((line) => <p key={line}>{line}</p>)}
        </div>
      )}
      {next?.offer === "check" && <p><Button tone="quiet" busy={checking} onClick={() => void check()}>{checking ? t.checking : t.check}</Button></p>}
      {next?.offer === "reload" && <p><Button tone="quiet" onClick={() => void load()}>{t.reload}</Button></p>}
      {next?.offer === "workspace" && <p><a href={href(idPath)}>{t.openWorkspace}</a></p>}
      <p>
        <Button aria-disabled={!canSend || undefined} aria-describedby={why ? WHY_ID : undefined}
          onClick={() => { if (canSend) setDialog(true); }}>{t.submit}</Button>
        <Button tone="quiet" onClick={() => router.push(href(`${idPath}/predaja/pregled`))}>{t.back}</Button>
      </p>
      {!confirmed && <p id={WHY_ID}>{t.declarationMissing} <a href={href(`${idPath}/predaja/izjava`)}>{t.openDeclaration}</a></p>}
      {confirmed && why && <p id={WHY_ID}>{why}</p>}
      <Dialog open={dialog} title={t.dialogTitle} onClose={closeDialog} dismissible={!sending}
        actions={(
          <>
            <Button busy={sending} onClick={() => void submit()}>{sending ? t.sending : t.submit}</Button>
            <Button tone="quiet" busy={sending} onClick={closeDialog}>{t.cancel}</Button>
          </>
        )}>
        <p>{fill(t.dialogText, { title, revision: t.revision, n: ready?.revision ?? 0, conversations: "" })}</p>
        <p>{fill(t.dialogWords, { n: words })} {t.dialogNoLonger}</p>
        {stage.kind === "closed" && <p>{t.dialogLate}</p>}
        {sending && <p role="status">{t.sending}</p>}
      </Dialog>
    </div>
  );
}
