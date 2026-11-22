"use client";

// WEB-2109 (PARITET Predaja E-10 / PD-3): step 4 in the host. Same server calls as
// src/components/student/Submission.tsx (evidence.open.post, submission.submit.post), now with the
// transport of "Provjeri stanje predaje" (readSubmittedWork), the extended deadline (C-15), the states
// of the prototype, aria-disabled instead of disabled, and a backdrop click that closes PD-3 (R-30).
import { Button, Dialog, StepActions, StepKv, StepLoading, StepNav, StepPanel, StepSpinner } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { browserTransport, createApi, goToSignIn } from "../../../../../../../src/client/api";
import { useOnline } from "../../../../../../../src/client/online-status";
import { readSubmissionState, submitWork, type LocalCall, type SubmitInput, type SubmitOutcome } from "../../../../../../../src/client/submission";
import { readConfirmed, useSessionTag } from "../../../../../../../src/components/predaja/Declaration";
import { confirmationKey } from "../../../../../../../src/components/predaja/flow";
import { oneAtATime, readWork, whileShown } from "../../../../../../../src/components/student/Submission";
import type { WorkRead } from "../../../../../../../src/components/student/SubmissionView";
import { SERVER_PREFIX } from "../../../../../../../src/client/api";
import { appHref } from "../../../../../../../src/components/index";
import { useHost } from "../../../context";
import { submitText as t } from "./messages.hr";
import StepLink from "../steps/StepLink";
import { clockOf, dayOf } from "../steps/time";
import { atOf, fill, nextOf, thousands, wordCount, type Answer, type Next, type SubmitStage } from "./model";
import { submitConfirmed, type Confirmed, type NewerChoice } from "./newer-local";
import { deviceHasNewer, sendLatestFromDevice } from "./local-hold";
import { routerPath } from "../../../../bases";

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
  // INT-16: the warning of a newer version on this device, in the same dialog; `notSent` after a send that did not arrive.
  const [newer, setNewer] = useState<{ readonly confirmed: Confirmed; readonly notSent: boolean } | null>(null);
  const [sendingLatest, setSendingLatest] = useState(false);
  const choose = useRef<((choice: NewerChoice | null) => void) | null>(null);
  const latestButton = useRef<HTMLButtonElement>(null);
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
    } else if (step.go === "receipt") router.push(routerPath(href(`${idPath}/predaja/potvrda`)));
    else if (step.go === "notice") router.push(routerPath(href(`/zadatak/${encodeURIComponent(assignmentId)}`)));
    else goToSignIn(href(here));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, idPath, here, base, router]);

  const load = useCallback(async () => {
    const mine = ++ticket.current;
    setWork({ kind: "loading" });
    setNext(null);
    const read = await readWork(assignmentId);
    if (mine !== ticket.current) return;
    if (read.kind === "notice") router.push(routerPath(href(`/zadatak/${encodeURIComponent(assignmentId)}`)));
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
    // Only a revision the server confirmed is submitted (INT-16); a newer one on this device is named first.
    const result = await submitConfirmed({ documentId: ready.documentId, revision: ready.revision }, {
      hasNewer: deviceHasNewer,
      ask: (confirmed, notSent) => new Promise<NewerChoice | null>((resolve) => {
        setSending(false);
        setSendingLatest(false);
        setNewer({ confirmed, notSent });
        choose.current = resolve;
        requestAnimationFrame(() => latestButton.current?.focus());
      }),
      sendLatest: (confirmed) => { setSendingLatest(true); return sendLatestFromDevice(assignmentId, confirmed); },
      submitRevision: (target) => { setSending(true); return send({ assignmentId, documentId: target.documentId, revision: target.revision }); },
    });
    choose.current = null;
    if (result.kind === "cancelled") {
      if (shown.current) { setNewer(null); setSending(false); setDialog(false); }
      return;
    }
    const outcome: SubmitOutcome | null = result.answer;
    whileShown(shown, (answer: SubmitOutcome) => { setSending(false); setSendingLatest(false); setNewer(null); setDialog(false); follow(answer); })(outcome);
  };
  const pick = (choice: NewerChoice | null) => {
    const resolve = choose.current;
    if (resolve === null) return;
    choose.current = null;
    if (choice !== null) setSending(true);
    resolve(choice);
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
  const closeDialog = () => {
    if (sending) return;
    if (choose.current !== null) pick(null);
    else setDialog(false);
  };
  useBackdropClose(root, dialog, closeDialog);
  const dueText = dueAt === null ? t.stageUnavailable : atOf(stage.kind === "extended" ? stage.until : stage.kind === "closed" ? stage.dueAt : dueAt);
  const untilDay = stage.kind === "extended" ? dayOf(stage.until) ?? stage.until : null;
  const lines = next === null ? [] : next.text;
  const offline = !online;
  // The tag beside the title: "Bez veze", or the extended deadline (prototype `submitPanel`).
  const panelTag = offline ? t.offlineTag : untilDay !== null ? fill(t.extendedTag, { until: untilDay }) : undefined;
  const goBack = () => router.push(routerPath(href(`${idPath}/predaja/pregled`)));

  return (
    <div ref={root} style={{ display: "contents" }}>
      <div><StepNav current={4} /></div>
      {work.kind === "loading" && <StepPanel title={t.panelTitle} busy><StepLoading message={t.loading} /></StepPanel>}
      {work.kind === "unavailable" && (
        <StepPanel title={t.panelTitle}>
          <p className="note" role="alert">{t.loadError}</p>
          <StepActions><Button tone="secondary" onClick={() => void load()}>{t.retry}</Button></StepActions>
        </StepPanel>
      )}
      {/* A failure the student cannot repeat from here is a panel of its own (prototype odbijeno, nedovrseno, nepoznato). */}
      {next !== null && !next.retry && (
        <StepPanel title={next.title ?? t.panelTitle}>
          {lines.map((line, i) => <p key={line} className="note" id={i === 0 ? OUTCOME_ID : undefined} tabIndex={i === 0 ? -1 : undefined}
            role={i === lines.length - 1 ? "alert" : undefined}>{line}</p>)}
          <StepActions>
            {next.offer === "check" && <Button tone="secondary" busy={checking} onClick={() => void check()}>{checking ? t.checking : t.check}</Button>}
            {next.offer === "reload" && <Button tone="secondary" onClick={() => void load()}>{t.reload}</Button>}
          </StepActions>
          {next.offer === "workspace" && <StepLink href={href(idPath)}>{t.openWorkspace}</StepLink>}
        </StepPanel>
      )}
      {(work.kind === "empty" || ready !== null) && (next === null || next.retry) && (
        <StepPanel title={t.title} tag={panelTag} busy={sending}>
          {work.kind === "empty" && <p className="note" role="status">{t.empty}</p>}
          {ready !== null && offline && (
            <>
              <StepKv label={t.due}>{dueText}</StepKv>
              <p className="note" role="status" id={WHY_ID}>{t.offline}</p>
            </>
          )}
          {ready !== null && !offline && stage.kind === "closed" && (
            <>
              <p className="note">{fill(t.lateNote, { due: atOf(stage.dueAt) })}</p>
              <p className="note">{t.noLonger}</p>
            </>
          )}
          {ready !== null && !offline && stage.kind === "extended" && untilDay !== null && (
            <>
              <p className="note">{fill(t.extendedNote, { until: untilDay, time: clockOf(stage.until) ?? "" })}</p>
              <p className="note">{t.noLonger}</p>
            </>
          )}
          {ready !== null && !offline && stage.kind !== "closed" && stage.kind !== "extended" && (
            <>
              <StepKv label={t.due}>{dueText}</StepKv>
              <StepKv label={t.words}>{thousands(words)}</StepKv>
              <StepKv label={t.conversations}>{t.conversationsUnavailable}</StepKv>
              {stage.kind === "unavailable" && <p className="note" role="note">{t.stageUnavailable}</p>}
              <p className="note">{t.timeNote}</p>
            </>
          )}
          {next !== null && next.retry && lines.map((line, i) => (
            <p key={line} className="note" id={i === 0 ? OUTCOME_ID : undefined} tabIndex={i === 0 ? -1 : undefined} role={i === lines.length - 1 ? "alert" : undefined}>{line}</p>
          ))}
          {next?.retry && next.offer === "workspace" && <StepLink href={href(idPath)}>{t.openWorkspace}</StepLink>}
          {!offline && !confirmed && ready !== null && (
            <p className="note" id={WHY_ID}>{t.declarationMissing} <StepLink href={href(`${idPath}/predaja/izjava`)}>{t.openDeclaration}</StepLink></p>
          )}
          {sending && <p className="note" role="status" id={WHY_ID}><StepSpinner /> {t.inProgress}</p>}
          <StepActions>
            <Button aria-disabled={!canSend || undefined} aria-describedby={why || sending ? WHY_ID : undefined}
              onClick={() => { if (canSend) setDialog(true); }}>{sending ? t.inProgress : t.submit}</Button>
            <Button tone="secondary" onClick={goBack}>{t.back}</Button>
          </StepActions>
        </StepPanel>
      )}
      {newer === null ? (
        <Dialog open={dialog} title={t.dialogTitle} onClose={closeDialog} dismissible={!sending}
          actions={(
            <>
              <Button busy={sending} onClick={() => void submit()}>{sending ? t.inProgress : t.submit}</Button>
              <Button tone="secondary" busy={sending} onClick={closeDialog}>{t.cancel}</Button>
            </>
          )}>
          <p className="note">{fill(t.dialogText, { title })}</p>
          <p className="note">{t.noLonger}</p>
          {stage.kind === "closed" && <p className="note">{t.dialogLate}</p>}
          {sending && <p className="note" role="status"><StepSpinner /> {t.inProgress}</p>}
        </Dialog>
      ) : (
        // INT-16: a warning, not a stop. The first choice is the default and takes the focus.
        <Dialog open={dialog} title={t.newer.title} onClose={closeDialog} dismissible={!sending}
          error={newer.notSent && !sending ? fill(t.newer.notSent, { n: newer.confirmed.revision }) : undefined}
          actions={(
            <>
              <Button ref={latestButton} busy={sending} onClick={() => pick("latest")}>{t.newer.latest}</Button>
              <Button tone="secondary" busy={sending} onClick={() => pick("confirmed")}>{fill(t.newer.confirmed, { n: newer.confirmed.revision })}</Button>
              <Button tone="secondary" busy={sending} onClick={closeDialog}>{t.cancel}</Button>
            </>
          )}>
          <p className="note">{t.newer.text}</p>
          {stage.kind === "closed" && <p className="note">{t.dialogLate}</p>}
          {sending && <p className="note" role="status"><StepSpinner /> {sendingLatest ? t.newer.sendingLatest : t.inProgress}</p>}
        </Dialog>
      )}
    </div>
  );
}
