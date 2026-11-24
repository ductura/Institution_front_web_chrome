"use client";

// WEB-2109 (PARITET Predaja E-10 / PD-3): step 4 in the host. Same server calls as
// src/components/student/Submission.tsx (evidence.open.post; the submission now on submission.submit-second.post), with the
// transport of "Provjeri stanje predaje" (readSubmittedWork), the extended deadline (C-15), the states
// of the prototype, aria-disabled instead of disabled, and a backdrop click that closes PD-3 (R-30).
// PIL-K-IZJAVA-VRATA: the declaration is read from the server (student.declaration.get), never from this
// browser; a failed read keeps sending closed, and the server's 409 declaration_required is a warning.
import { Button, Dialog, StepActions, StepCheck, StepKv, StepLoading, StepNav, StepPanel, StepSpinner } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { browserTransport, createApi, goToSignIn } from "../../../../../../../src/client/api";
import { useOnline } from "../../../../../../../src/client/online-status";
import { readSubmissionState, submitWork, type LocalCall, type SubmitInput, type SubmitOutcome } from "../../../../../../../src/client/submission";
import { oneAtATime, readWork, whileShown } from "../../../../../../../src/components/student/Submission";
import type { WorkRead } from "../../../../../../../src/components/student/SubmissionView";
import { SERVER_PREFIX } from "../../../../../../../src/client/api";
import { appHref } from "../../../../../../../src/components/index";
import { useHost } from "../../../context";
import { submitText as t } from "./messages.hr";
import { clockOf, dayOf } from "../steps/time";
import { atOf, fill, nextOf, thousands, wordCount, type Answer, type Known, type Next, type SubmitStage } from "./model";
import OutcomePanel, { OUTCOME_ID } from "./OutcomePanel";
import { dialogLateLine, isLate, lateLine, timingOf, timingTag, type Timing } from "./timing";
import { useRecheck } from "./use-recheck";
import { useSavedOnServer } from "./use-saved-on-server";
import { submitConfirmed, type Confirmed, type NewerChoice } from "./newer-local";
import { deviceHasNewer, sendLatestFromDevice } from "./local-hold";
import { takeChoice } from "./newer-choice";
import DeclarationDialog from "../declaration/DeclarationDialog";
import { dialogOpener, isStale } from "../declaration/dialog-model";
import { routerPath } from "../../../../bases";
import { opensSending, serverGate, useDeclarationGate, type GateRead } from "../summary/declaration-gate";
// Review #590, 3: the declaration in the words of the one source (PR-2), not step 4's own.
import { declarationText } from "../summary/declaration-gate";

const WHY_ID = "submission-why";
const LATE_WHY_ID = "submission-late-why";

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
  /** Where the deadline stands, with the teacher's exception (PR-17); from `stage` alone when not given. */
  readonly timing?: Timing;
  /** The declaration's gate; the server's by default, a recorded one in tests. */
  readonly declarationGate?: GateRead;
};

/** PD-3 (PR-7): the dialog's sentence from what is true of this submission: the declaration only when confirmed. */
export function dialogSentence(title: string, withDeclaration: boolean, conversations: number, words: number): string {
  const attached = conversations === 0 ? "" : conversations === 1 ? t.dialogConversationOne : fill(t.dialogConversations, { n: conversations });
  return `${fill(t.dialogText, { title })}${withDeclaration ? t.dialogWithDeclaration : ""}${attached}${fill(t.dialogWords, { n: thousands(words) })}`;
}

export default function SubmitStep(props: SubmitStepProps) {
  return <Step key={props.assignmentId} {...props} />;
}

function Step({ assignmentId, title, stage, dueAt, timing: given, declarationGate = serverGate }: SubmitStepProps) {
  const router = useRouter();
  const { base } = useHost();
  const online = useOnline();
  const href = (path: string) => appHref(base, path);
  const root = useRef<HTMLDivElement>(null);
  const [work, setWork] = useState<WorkRead>({ kind: "loading" });
  const [dialog, setDialog] = useState(false);
  // NF-3 PR-5 (PD-10): the declaration as a dialog, without leaving this step.
  const [declaring, setDeclaring] = useState(false);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  // INT-16: the warning of a newer version on this device, in the same dialog; `notSent` after a send that did not arrive.
  const [newer, setNewer] = useState<{ readonly confirmed: Confirmed; readonly notSent: boolean } | null>(null);
  const [sendingLatest, setSendingLatest] = useState(false);
  const choose = useRef<((choice: NewerChoice | null) => void) | null>(null);
  const latestButton = useRef<HTMLButtonElement>(null);
  const [next, setNext] = useState<Extract<Next, { go: null }> | null>(null);
  // PR-7: the second confirmation of a late submission, asked in the dialog each time it opens.
  const [lateOk, setLateOk] = useState(false);
  const submitButton = useRef<HTMLButtonElement>(null);
  const timing = given ?? timingOf(stage, dueAt, null, Date.now());
  const idPath = `/rad/${encodeURIComponent(assignmentId)}`;
  const here = `${idPath}/predaja/slanje`;
  const send = useRef(oneAtATime((input: SubmitInput) => submitWork(input, { local }))).current;
  const ticket = useRef(0);
  const shown = useRef(false);

  const follow = useCallback((answer: Answer, known: Known = { requestedAt: null, alternative: false }) => {
    const step = nextOf(answer, { ...known, timing });
    if (step.go === null) {
      setNext(step);
      requestAnimationFrame(() => document.getElementById(OUTCOME_ID)?.focus());
    } else if (step.go === "receipt") router.push(routerPath(href(`${idPath}/predaja/potvrda`)));
    else if (step.go === "notice") router.push(routerPath(href(`/zadatak/${encodeURIComponent(assignmentId)}`)));
    else goToSignIn(href(here));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, idPath, here, base, router, timing]);

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

  const { gate, reload: readGate } = useDeclarationGate(assignmentId, declarationGate);
  const confirmed = opensSending(gate);
  useEffect(() => { if (gate.kind === "signedOut") goToSignIn(href(here)); }, [gate.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { shown.current = true; return () => { shown.current = false; }; }, []);
  useEffect(() => { void load(); return () => { ticket.current += 1; }; }, [load]);

  const ready = work.kind === "ready" ? work : null;
  const submit = async () => {
    if (ready === null || !online || sending) return;
    setSending(true);
    // Only a revision the server confirmed is submitted (INT-16); a newer one on this device is named first.
    const result = await submitConfirmed({ documentId: ready.documentId, revision: ready.revision }, {
      hasNewer: deviceHasNewer,
      // NF-3 PR-10: a choice made on step 3 for this very revision is not asked again (once).
      ask: (confirmed, notSent) => {
        const kept = notSent ? null : takeChoice(assignmentId, confirmed);
        return kept !== null ? Promise.resolve(kept) : new Promise<NewerChoice | null>((resolve) => {
        setSending(false);
        setSendingLatest(false);
        setNewer({ confirmed, notSent });
        choose.current = resolve;
        requestAnimationFrame(() => latestButton.current?.focus());
      });
      },
      sendLatest: (confirmed) => { setSendingLatest(true); return sendLatestFromDevice(assignmentId, confirmed); },
      submitRevision: (target) => { setSending(true); return send({ assignmentId, documentId: target.documentId, revision: target.revision }); },
    });
    choose.current = null;
    if (result.kind === "cancelled") {
      if (shown.current) { setNewer(null); setSending(false); setDialog(false); }
      return;
    }
    const outcome: SubmitOutcome | null = result.answer;
    // The server holds no confirmed declaration for this revision: read the gate again, so sending stays closed.
    if (outcome?.kind === "izjava") readGate();
    // PR-8: an unfinished submission names the request time only when the server holds it (`ceka`).
    const state = outcome?.kind === "nedovrseno" ? await readSubmissionState(local, assignmentId) : null;
    const requestedAt = state?.kind === "ceka" ? state.requestedAt : null;
    whileShown(shown, (answer: SubmitOutcome) => {
      setSending(false); setSendingLatest(false); setNewer(null); setDialog(false); follow(answer, { requestedAt, alternative: false });
    })(outcome);
  };
  const pick = (choice: NewerChoice | null) => {
    const resolve = choose.current;
    if (resolve === null) return;
    choose.current = null;
    if (choice !== null) setSending(true);
    resolve(choice);
  };
  // PR-9: an unknown outcome is read again on its own; "Provjeri stanje predaje" is one more read of the same count.
  const recheck = useRecheck(next?.recheck === true, () => readSubmissionState(local, assignmentId),
    (state) => whileShown(shown, (answer: Answer) => follow(answer))({ kind: "check", state }));
  const check = async () => {
    if (next?.recheck === true) { recheck.readNow(); return; }
    if (checking) return;
    setChecking(true);
    const state = await readSubmissionState(local, assignmentId);
    whileShown(shown, (answer: Answer) => { setChecking(false); follow(answer); })({ kind: "check", state });
  };
  // PR-8: "Pokušaj ponovno" after a refusal opens once the device holds nothing the server has not confirmed.
  const saved = useSavedOnServer(next?.offer === "retryWhenSaved" && ready !== null ? ready.documentId : null, deviceHasNewer);

  const late = isLate(timing);
  const canSend = ready !== null && confirmed && online && !sending && (next === null || next.retry);
  const canConfirm = canSend || sending;
  const lateHold = late && !lateOk;
  const declarationWhy = declarationText(gate);
  const why = !online ? t.offline : !confirmed ? declarationWhy : undefined;
  const words = ready === null ? 0 : wordCount(ready.nodes);
  const closeDialog = () => {
    if (sending) return;
    if (choose.current !== null) pick(null);
    else setDialog(false);
  };
  useBackdropClose(root, dialog, closeDialog);
  const dueText = dueAt === null ? t.stageUnavailable : atOf(stage.kind === "extended" ? stage.until : stage.kind === "closed" ? stage.dueAt : dueAt);
  const lines = next === null ? [] : next.text;
  const offline = !online;
  // The tag beside the title: "Bez veze", the teacher's exception or the extended deadline (prototype `submitPanel`).
  const panelTag = offline ? t.offlineTag : timingTag(timing);
  const goBack = () => router.push(routerPath(href(`${idPath}/predaja/pregled`)));
  const late_line = lateLine(timing);
  const openDialog = () => {
    if (!canSend) return;
    setLateOk(false);
    setDialog(true);
  };


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
      {/* A failure the student cannot repeat from here is a panel of its own (PR-8, PR-9, PR-17). */}
      {next !== null && !next.retry && (
        <OutcomePanel line={next} workHref={href(idPath)} declarationHref={href(`${idPath}/predaja/izjava`)} onBack={goBack}
          onReload={() => void load()} onRetry={() => void load()} onCheck={() => void check()} checking={checking}
          recheck={recheck.state} saved={saved} />
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
          {ready !== null && !offline && late_line !== null && (
            <>
              <p className="note" id="sb-late">{late_line}</p>
              {timing.kind === "exception" && <StepKv label={t.late.exceptionDue}>{atOf(timing.until)}</StepKv>}
              <p className="note">{t.timeNote}</p>
            </>
          )}
          {ready !== null && !offline && timing.kind === "extended" && (
            <>
              <p className="note">{fill(t.extendedNote, { until: dayOf(timing.until) ?? timing.until, time: clockOf(timing.until) ?? "" })}</p>
              <p className="note">{t.noLonger}</p>
            </>
          )}
          {ready !== null && !offline && late_line === null && timing.kind !== "extended" && (
            <>
              <StepKv label={t.due}>{dueText}</StepKv>
              <StepKv label={t.words}>{thousands(words)}</StepKv>
              {gate.kind === "not_required" && <StepKv label={t.declarationRow}>{declarationWhy}</StepKv>}
              {stage.kind === "unavailable" && <p className="note" role="note">{t.stageUnavailable}</p>}
              <p className="note">{t.timeNote}</p>
            </>
          )}
          {next !== null && next.retry && lines.map((line, i) => (
            <p key={line} className="note" id={i === 0 ? OUTCOME_ID : undefined} tabIndex={i === 0 ? -1 : undefined} role={i === lines.length - 1 ? "alert" : undefined}>{line}</p>
          ))}
          {!offline && !confirmed && ready !== null && next?.offer !== "declaration" && (
            <p className="note" id={WHY_ID}>{declarationWhy}{" "}
              {dialogOpener(gate) !== null && <Button tone="secondary" size="small" onClick={() => setDeclaring(true)}>{dialogOpener(gate)}</Button>}
            </p>
          )}
          {!offline && gate.kind === "unavailable" && ready !== null && <StepActions><Button tone="secondary" onClick={readGate}>{t.declarationRetry}</Button></StepActions>}
          {next?.retry && next.offer === "declaration" && <Button tone="secondary" onClick={() => setDeclaring(true)}>{dialogOpener(gate) ?? t.openDeclaration}</Button>}
          {sending && <p className="note" role="status" id={WHY_ID}><StepSpinner /> {t.inProgress}</p>}
          <StepActions>
            <Button aria-disabled={!canSend || undefined} aria-describedby={why || sending ? WHY_ID : undefined}
              onClick={openDialog}>{sending ? t.inProgress : t.submit}</Button>
            <Button tone="secondary" onClick={goBack}>{t.back}</Button>
          </StepActions>
        </StepPanel>
      )}
      <DeclarationDialog assignmentId={assignmentId} open={declaring} stale={isStale(gate)} onSignIn={() => goToSignIn(href(here))}
        onClose={() => { setDeclaring(false); readGate(); }} />
      {newer === null ? (
        // PD-3 (PR-7): the focus on "Predaj rad"; for a late submission on its confirmation, the dialog's first control.
        <Dialog open={dialog} title={t.dialogTitle} onClose={closeDialog} dismissible={!sending} initialFocus={late ? undefined : submitButton}
          actions={(
            <>
              <Button ref={submitButton} busy={sending} aria-disabled={(lateHold && !sending) || !canConfirm || undefined}
                aria-describedby={lateHold && !sending ? LATE_WHY_ID : undefined}
                onClick={() => { if (!lateHold && canConfirm) void submit(); }}>{sending ? t.inProgress : t.submit}</Button>
              <Button tone="secondary" busy={sending} onClick={closeDialog}>{t.cancel}</Button>
            </>
          )}>
          <p className="note">{dialogSentence(title, gate.kind === "confirmed", 0, words)}</p>
          <p className="note">{t.noLonger}</p>
          {late && (
            <>
              <p className="note">{dialogLateLine(timing)}</p>
              <StepCheck id="sb-late-ok" checked={lateOk} onChange={setLateOk} disabled={sending}>{t.lateConfirm}</StepCheck>
              {lateHold && <p className="meta" id={LATE_WHY_ID}>{t.lateConfirmWhy}</p>}
            </>
          )}
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
          {late && <p className="note">{dialogLateLine(timing)}</p>}
          {sending && <p className="note" role="status"><StepSpinner /> {sendingLatest ? t.newer.sendingLatest : t.inProgress}</p>}
        </Dialog>
      )}
    </div>
  );
}
