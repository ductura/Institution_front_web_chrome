"use client";

// WEB-V13-PREDAJA: step 4 ("Predaja") of a slides work, mounted by host/student/submission/index.tsx
// (SubmitStepPage) when the assignment's kind is slides. It is the text submission's step with the
// document of a slides work: the same declaration gate (read from the server, PIL-K-IZJAVA-VRATA),
// the same route (submission.submit-second.post through submitWork), the same deadline stages,
// the same outcomes (a signed receipt is the only "predano"), and the same warning for a newer
// version on this device (INT-16). Only the check of the work differs: the slide count against
// the assignment's range (requirements.ts). Withdrawal and the history of submissions (step 5,
// AfterSubmission) do not depend on the kind of document and stay as they are.
import { Button, Dialog, StepActions, StepKv, StepLoading, StepPanel, StepSpinner, StepCheck } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { browserTransport, createApi, goToSignIn, SERVER_PREFIX } from "../../../../../../src/client/api.ts";
import { openWork } from "../../../../../../src/client/evidence-ingest.ts";
import { useOnline } from "../../../../../../src/client/online-status.ts";
import { appHref } from "../../../../../../src/components/index.ts";
import { readSubmissionState, submitWork, type LocalCall, type SubmitInput, type SubmitOutcome } from "../../../../../../src/client/submission.ts";
import { routerPath } from "../../../bases";
import { useHost } from "../../context";
import { oneAtATime, whileShown } from "../../student/submission/work-read";
import { clockOf, dayOf } from "../../student/submission/steps/time";
import { submitText as t } from "../../student/submission/submit/messages.hr";
import { atOf, fill, nextOf, thousands, type Answer, type Known, type Next, type SubmitStage } from "../../student/submission/submit/model";
import OutcomePanel, { OUTCOME_ID } from "../../student/submission/submit/OutcomePanel";
import { dialogLateLine, isLate, lateLine, timingOf, timingTag, type Timing } from "../../student/submission/submit/timing";
import { useRecheck } from "../../student/submission/submit/use-recheck";
import { useSavedOnServer } from "../../student/submission/submit/use-saved-on-server";
import { submitConfirmed, waitForLatest, type Confirmed, type NewerChoice } from "../../student/submission/submit/newer-local";
import { deviceHasNewer, LATEST_EVERY_MS, LATEST_LIMIT_MS } from "../../student/submission/submit/local-hold";
import { takeChoice } from "../../student/submission/submit/newer-choice";
import { opensSending, serverGate, useDeclarationGate, declarationText, type GateRead } from "../../student/submission/summary/declaration-gate";
import { checkSlides, readSlidesWork, type SlideRange, type SlidesCheck, type SlidesWorkRead } from "./requirements";
import { slidesSubmitText as s } from "./messages.hr";
import { LoadAlert } from "../../states/States";
import styles from "./submit.module.css";

const WHY_ID = "slides-submission-why";
const LATE_WHY_ID = "slides-submission-late-why";

/** The transport of student.submission.get: the route the host already reads. */
const local: LocalCall = async (_id, { params }) => {
  const answer = await browserTransport(new URL(`${SERVER_PREFIX}student/assignments/${encodeURIComponent(params.assignmentId)}/submission`, globalThis.location.origin), {
    method: "GET", credentials: "include", redirect: "manual", cache: "no-store", headers: { accept: "application/json" },
  });
  if (answer.status === 200 && answer.headers.get("content-type")?.startsWith("application/json")) return { ok: true, status: 200, body: await answer.json() };
  return { ok: false, status: answer.status, code: "unavailable" };
};

type Read = { readonly kind: "loading" } | SlidesWorkRead;

export type SlidesSubmitProps = {
  readonly assignmentId: string;
  readonly title: string;
  readonly stage: SubmitStage;
  readonly dueAt: string | null;
  readonly timing?: Timing;
  readonly declarationGate?: GateRead;
  /** The slide range of the assignment; `null` until the published contract carries one. */
  readonly slideRange?: SlideRange;
  /** The read of the work as the server confirmed it; the server's by default, a recorded one in tests. */
  readonly readWork?: (assignmentId: string) => Promise<SlidesWorkRead>;
};

const serverRead = (assignmentId: string): Promise<SlidesWorkRead> =>
  openWork(assignmentId).then(readSlidesWork).catch(() => ({ kind: "unavailable" as const }));

/** Why sending is closed for this check, in words; null when the check lets it through. */
export function checkLine(check: SlidesCheck): string | null {
  switch (check.kind) {
    case "ok": return null;
    case "empty": return s.empty;
    case "tooFew": return fill(s.tooFew, { min: check.min, count: check.count });
    case "tooMany": return fill(s.tooMany, { max: check.max, count: check.count });
    case "unreadableRange": return null; // the server checks on submission; the page only says so
  }
}

export default function SlidesSubmit(props: SlidesSubmitProps) {
  return <Step key={props.assignmentId} {...props} />;
}

function Step({ assignmentId, title, stage, dueAt, timing: given, declarationGate = serverGate, slideRange = null, readWork = serverRead }: SlidesSubmitProps) {
  const router = useRouter();
  const { base } = useHost();
  const online = useOnline();
  const href = (path: string) => appHref(base, path);
  const [work, setWork] = useState<Read>({ kind: "loading" });
  const [dialog, setDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [newer, setNewer] = useState<{ readonly confirmed: Confirmed; readonly notSent: boolean } | null>(null);
  const choose = useRef<((choice: NewerChoice | null) => void) | null>(null);
  const latestButton = useRef<HTMLButtonElement>(null);
  const [next, setNext] = useState<Extract<Next, { go: null }> | null>(null);
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
    if (read.kind === "notFound") router.push(routerPath(href(`/zadatak/${encodeURIComponent(assignmentId)}`)));
    else if (read.kind === "signedOut") goToSignIn(href(here));
    else if (read.kind === "ready" && read.submitted) router.push(routerPath(href(`${idPath}/predaja/potvrda`)));
    else setWork(read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, here, base, router]);

  const { gate, reload: readGate } = useDeclarationGate(assignmentId, declarationGate);
  const confirmed = opensSending(gate);
  useEffect(() => { if (gate.kind === "signedOut") goToSignIn(href(here)); }, [gate.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { shown.current = true; return () => { shown.current = false; }; }, []);
  useEffect(() => { void load(); return () => { ticket.current += 1; }; }, [load]);

  const ready = work.kind === "ready" ? work : null;
  const check = ready === null ? null : checkSlides(ready.document, slideRange);
  const checkText = check === null ? null : checkLine(check);
  const slides = ready === null ? 0 : ready.document.slides.length;

  const submit = async () => {
    if (ready === null || check === null || check.kind === "empty" || check.kind === "tooFew" || check.kind === "tooMany" || !online || sending) return;
    setSending(true);
    const result = await submitConfirmed({ documentId: ready.documentId, revision: ready.revision }, {
      hasNewer: deviceHasNewer,
      ask: (confirmedRevision, notSent) => {
        const kept = notSent ? null : takeChoice(assignmentId, confirmedRevision);
        return kept !== null ? Promise.resolve(kept) : new Promise<NewerChoice | null>((resolve) => {
          setSending(false);
          setNewer({ confirmed: confirmedRevision, notSent });
          choose.current = resolve;
          requestAnimationFrame(() => latestButton.current?.focus());
        });
      },
      // The slides saver of the workspace sends the newest version; this page waits, within a limit, for the server to confirm it.
      sendLatest: (target) => waitForLatest(target, {
        hasNewer: deviceHasNewer,
        readConfirmed: async () => {
          const read = await readWork(assignmentId);
          return read.kind === "ready" ? { documentId: read.documentId, revision: read.revision } : null;
        },
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: () => Date.now(), limitMs: LATEST_LIMIT_MS, everyMs: LATEST_EVERY_MS,
      }),
      submitRevision: (target) => { setSending(true); return send({ assignmentId, documentId: target.documentId, revision: target.revision }); },
    });
    choose.current = null;
    if (result.kind === "cancelled") {
      if (shown.current) { setNewer(null); setSending(false); setDialog(false); }
      return;
    }
    const outcome: SubmitOutcome | null = result.answer;
    if (outcome?.kind === "izjava") readGate();
    const state = outcome?.kind === "nedovrseno" ? await readSubmissionState(local, assignmentId) : null;
    const requestedAt = state?.kind === "ceka" ? state.requestedAt : null;
    whileShown(shown, (answer: SubmitOutcome) => {
      setSending(false); setNewer(null); setDialog(false); follow(answer, { requestedAt, alternative: false });
    })(outcome);
  };
  const pick = (choice: NewerChoice | null) => {
    const resolve = choose.current;
    if (resolve === null) return;
    choose.current = null;
    if (choice !== null) setSending(true);
    resolve(choice);
  };
  const recheck = useRecheck(next?.recheck === true, () => readSubmissionState(local, assignmentId),
    (state) => whileShown(shown, (answer: Answer) => follow(answer))({ kind: "check", state }));
  const checkState = async () => {
    if (next?.recheck === true) { recheck.readNow(); return; }
    if (checking) return;
    setChecking(true);
    const state = await readSubmissionState(local, assignmentId);
    whileShown(shown, (answer: Answer) => { setChecking(false); follow(answer); })({ kind: "check", state });
  };
  const saved = useSavedOnServer(next?.offer === "retryWhenSaved" && ready !== null ? ready.documentId : null, deviceHasNewer);

  const late = isLate(timing);
  const closedByCheck = checkText !== null;
  const canSend = ready !== null && confirmed && online && !sending && !closedByCheck && (next === null || next.retry);
  const canConfirm = canSend || sending;
  const lateHold = late && !lateOk;
  const declarationWhy = declarationText(gate);
  const why = !online ? s.offline : checkText ?? (!confirmed ? declarationWhy : undefined);
  const closeDialog = () => {
    if (sending) return;
    if (choose.current !== null) pick(null);
    else setDialog(false);
  };
  const dueText = dueAt === null ? t.stageUnavailable : atOf(stage.kind === "extended" ? stage.until : stage.kind === "closed" ? stage.dueAt : dueAt);
  const lines = next === null ? [] : next.text;
  const offline = !online;
  const panelTag = offline ? t.offlineTag : timingTag(timing);
  const goBack = () => router.push(routerPath(href(`${idPath}/predaja/pregled`)));
  const late_line = lateLine(timing);
  const openDialog = () => { if (!canSend) return; setLateOk(false); setDialog(true); };

  return (
    <div style={{ display: "contents" }}>
      {work.kind === "loading" && <StepPanel title={t.panelTitle} busy><StepLoading message={s.loading} /></StepPanel>}
      {work.kind === "unavailable" && (
        <StepPanel title={t.panelTitle}>
          <LoadAlert body={s.loadError} />
          <StepActions><Button tone="secondary" onClick={() => void load()}>{t.retry}</Button></StepActions>
        </StepPanel>
      )}
      {work.kind === "notSlides" && (
        <StepPanel title={t.panelTitle}>
          <p className="note" role="alert">{s.notSlides}</p>
          <StepActions><Button tone="secondary" onClick={() => router.push(routerPath(href(idPath)))}>{s.openWorkspace}</Button></StepActions>
        </StepPanel>
      )}
      {next !== null && !next.retry && (
        <OutcomePanel line={next} workHref={href(idPath)} declarationHref={href(`${idPath}/predaja/izjava`)} onBack={goBack}
          onReload={() => void load()} onRetry={() => void load()} onCheck={() => void checkState()} checking={checking}
          recheck={recheck.state} saved={saved} />
      )}
      {ready !== null && (next === null || next.retry) && (
        <StepPanel title={s.title} tag={panelTag} busy={sending}>
          {offline && (
            <>
              <StepKv label={t.due}>{dueText}</StepKv>
              <p className="note" role="status" id={WHY_ID}>{s.offline}</p>
            </>
          )}
          {!offline && late_line !== null && (
            <>
              <p className="note" id="sb-late">{late_line}</p>
              {timing.kind === "exception" && <StepKv label={t.late.exceptionDue}>{atOf(timing.until)}</StepKv>}
              <p className="note">{s.noLonger}</p>
            </>
          )}
          {!offline && timing.kind === "extended" && (
            <p className="note">{fill(t.extendedNote, { until: dayOf(timing.until) ?? timing.until, time: clockOf(timing.until) ?? "" })}</p>
          )}
          {!offline && late_line === null && timing.kind !== "extended" && (
            <>
              <StepKv label={t.due}>{dueText}</StepKv>
              <StepKv label={s.slides}>{thousands(slides)}</StepKv>
              {gate.kind === "not_required" && <StepKv label={t.declarationRow}>{declarationWhy}</StepKv>}
              {stage.kind === "unavailable" && <p className="note" role="note">{t.stageUnavailable}</p>}
              <p className="note">{s.serverNote}</p>
            </>
          )}
          {checkText !== null && <p className={`note ${styles.rangeError}`} role="alert" id={WHY_ID}>{checkText}</p>}
          {check?.kind === "unreadableRange" && <p className={`note ${styles.rangeError}`} role="alert">{s.unreadableRange}</p>}
          {next !== null && next.retry && lines.map((line, i) => (
            <p key={line} className="note" id={i === 0 ? OUTCOME_ID : undefined} tabIndex={i === 0 ? -1 : undefined} role={i === lines.length - 1 ? "alert" : undefined}>{line}</p>
          ))}
          {!offline && !confirmed && next?.offer !== "declaration" && <p className={gate.kind === "unavailable" ? `note ${styles.rangeError}` : "note"} id={checkText === null ? WHY_ID : undefined}>{declarationWhy}</p>}
          {!offline && gate.kind === "unavailable" && <StepActions><Button tone="secondary" onClick={readGate}>{t.declarationRetry}</Button></StepActions>}
          {sending && <p className="note" role="status" id={WHY_ID}><StepSpinner /> {t.inProgress}</p>}
          <StepActions>
            <Button aria-disabled={!canSend || undefined} aria-describedby={why || sending ? WHY_ID : undefined} onClick={openDialog}>{sending ? t.inProgress : t.submit}</Button>
            <Button tone="secondary" onClick={goBack}>{t.back}</Button>
          </StepActions>
        </StepPanel>
      )}
      {newer === null ? (
        <Dialog open={dialog} title={s.title} onClose={closeDialog} dismissible={!sending} initialFocus={late ? undefined : submitButton}
          actions={(
            <>
              <Button ref={submitButton} busy={sending} aria-disabled={(lateHold && !sending) || !canConfirm || undefined}
                aria-describedby={lateHold && !sending ? LATE_WHY_ID : undefined}
                onClick={() => { if (!lateHold && canConfirm) void submit(); }}>{sending ? t.inProgress : t.submit}</Button>
              <Button tone="secondary" busy={sending} onClick={closeDialog}>{t.cancel}</Button>
            </>
          )}>
          <p className="note">{fill(s.dialogText, { title })}{gate.kind === "confirmed" ? t.dialogWithDeclaration : ""}{fill(s.dialogSlides, { n: thousands(slides) })}</p>
          <p className="note">{s.noLonger}</p>
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
        <Dialog open={dialog} title={t.newer.title} onClose={closeDialog} dismissible={!sending}
          error={newer.notSent && !sending ? fill(t.newer.notSent, { n: newer.confirmed.revision }) : undefined}
          actions={(
            <>
              <Button ref={latestButton} busy={sending} onClick={() => pick("latest")}>{t.newer.latest}</Button>
              <Button tone="secondary" busy={sending} onClick={() => pick("confirmed")}>{fill(t.newer.confirmed, { n: newer.confirmed.revision })}</Button>
              <Button tone="secondary" busy={sending} onClick={closeDialog}>{t.cancel}</Button>
            </>
          )}>
          <p className="note">{s.newerText}</p>
          {late && <p className="note">{dialogLateLine(timing)}</p>}
          {sending && <p className="note" role="status"><StepSpinner /> {t.inProgress}</p>}
        </Dialog>
      )}
    </div>
  );
}
