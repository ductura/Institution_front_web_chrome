"use client";

// HOST-S2 (graditelj, 21. 11. 2026.): the five steps of the submission in the
// host (WEB-24..27), read only through src/client, as the copied pages
// src/app/rad/[assignmentId]/predaja/** do on the server: the assignment is
// checked on every step with student.assignments.get and
// student.assignment-work.get. Signed out → AAI@EduHr sign-in, back to the
// step; a notice not yet acknowledged → the notice; anyone else's or an
// unknown assignment → not found. Every path a step opens gets the host's
// base. "Predano" only with the signed receipt (B-6): step 5 reads it from
// the server on every visit.
import { StepFrame } from "@ductura/ui";
import { notFound, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { appHref } from "../../../../../../src/components/index.ts";
import { assignmentIdOf, editorWorkRead } from "../../../../../../src/components/editor/EditorPage.read.ts";
import { readSubmittedWork } from "../../../../../../src/components/editor/mentor/work-state/submitted-work-read.ts";
import { studentReceiptRead, type ReceiptRead } from "../../../../../../src/components/predaja/ReceiptPanel.tsx";
import { stageOf, type Stage } from "../../../../../../src/components/predaja/stage.ts";
import { browserTransport, createApi, goToSignIn } from "../../../../../../src/client/api.ts";

import { nextPath } from "../../../bases";
import { useHost } from "../../context";
import PortableRecord from "../portable-record/PortableRecord";
import SubmissionPackage from "../submission-package/SubmissionPackage";
import DeclarationStep from "./declaration/DeclarationStep";
import { createStepPorts, type StepPorts } from "./declaration/step-ports";
import { stepsText } from "./steps/messages.hr";
import StepsShell, { StepsLoading } from "./steps/StepsShell";
import { atOf } from "./steps/time";
import ReceiptScreen from "./receipt/ReceiptScreen";
import { receiptText } from "./receipt/messages.hr";
import BeforeSubmitStep from "./summary/BeforeSubmitStep";
import { VERIFY_PATH } from "../../public/verify/model";
import WithdrawSubmission from "./withdraw/WithdrawSubmission";
import SubmitStep from "./submit/SubmitStep";
import { extendedDueOf, submitStageOf } from "./submit/model";

const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

type Step = "" | "izjava" | "pregled" | "slanje" | "potvrda";

/** What the checked assignment allows a step to show. */
type Checked =
  | { readonly kind: "ready"; readonly course: string; readonly title: string; readonly workState: string; readonly stage: Stage; readonly dueAt: string; readonly extendedDueAt: string | null }
  | { readonly kind: "unavailable" };

type Shown<T> = { kind: "loading" } | { kind: "notFound" } | { kind: "ready"; value: T };

function stepPath(assignmentId: string, step: Step): string {
  const base = `/rad/${encodeURIComponent(assignmentId)}/predaja`;
  return step === "" ? base : `${base}/${step}`;
}

/**
 * The check every step makes, then `then` with what it allows. Sign-in, the
 * notice and not found are decided here, as on the copied pages.
 */
function useChecked<T>(raw: string, step: Step, then: (checked: Checked, assignmentId: string) => Promise<T | null>): Shown<T> & { reload: () => void } {
  const { base } = useHost();
  const router = useRouter();
  const [shown, setShown] = useState<Shown<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setShown({ kind: "loading" });
    const assignmentId = assignmentIdOf(raw);
    if (assignmentId === null) {
      setShown({ kind: "notFound" });
      return;
    }
    void (async () => {
      const client = createApi();
      const [assignments, work] = await Promise.all([
        client("student.assignments.get", NONE).catch(() => UNREACHED),
        client("student.assignment-work.get", NONE).catch(() => UNREACHED),
      ]);
      if (!live) return;
      const read = editorWorkRead(assignmentId, assignments as never, work as never);
      if (read.kind === "signedOut") return goToSignIn(appHref(base, stepPath(assignmentId, step)));
      if (read.kind === "noticeFirst") return router.replace(nextPath(base, `/zadatak/${assignmentId}`));
      if (read.kind === "notFound") return setShown({ kind: "notFound" });
      const checked: Checked = read.kind === "ready"
        ? { kind: "ready", course: read.course, title: read.title, workState: read.workState, stage: stageOf(read.workState, read.dueAt, Date.now()), dueAt: read.dueAt, extendedDueAt: extendedDueOf(assignments.ok ? assignments.body : null, assignmentId) }
        : { kind: "unavailable" };
      const value = await then(checked, assignmentId);
      if (live && value !== null) setShown({ kind: "ready", value });
    })();
    return () => {
      live = false;
    };
  }, [raw, base, attempt]);
  return { ...shown, reload: () => setAttempt((n) => n + 1) };
}

type Loading = { readonly title: string; readonly message: string; readonly label: string; readonly workHref: string };

function Shown<T>({ shown, loading, children }: { shown: Shown<T>; loading: Loading; children: (value: T) => ReactNode }) {
  if (shown.kind === "notFound") notFound();
  if (shown.kind === "loading") return <StepsLoading {...loading} />;
  return <>{children(shown.value)}</>;
}

/** When the server says the request arrived, written as the prototype writes it; null when it does not say. */
async function requestedAtOf(assignmentId: string): Promise<string | null> {
  const read = await readSubmittedWork(assignmentId, { baseUrl: window.location.origin, fetchImpl: browserTransport }).catch(() => null);
  if (read === null) return null;
  if (read.kind === "potvrdeno") return atOf(read.receipt.payload.requestedAt);
  return read.kind === "ceka" ? atOf(read.requestedAt) : null;
}

/** The host's base on every path a step opens. */
function useHrefOf(): (path: string) => string {
  const { base } = useHost();
  return (path) => appHref(base, path);
}

/** The work's page under the host's base: where "Natrag na rad" leads. */
function useWorkHref(assignmentId: string): string {
  const hrefOf = useHrefOf();
  return hrefOf(`/rad/${encodeURIComponent(assignmentId)}`);
}

/** `/rad/<id>/predaja`: no screen of its own, only the step the submission stands at. */
export function SubmissionStartPage({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const { base } = useHost();
  const workHref = useWorkHref(assignmentId);
  const shown = useChecked<never>(assignmentId, "", async (checked, id) => {
    const step = checked.kind === "ready" && checked.workState === "submitted" ? "potvrda" : "izjava";
    router.replace(nextPath(base, stepPath(id, step)));
    return null;
  });
  return <Shown shown={shown} loading={{ title: stepsText.panelTitle, message: stepsText.loadingWork, label: stepsText.panelLabel, workHref }}>{() => null}</Shown>;
}

type Opened = { readonly checked: Checked; readonly id: string; readonly requestedAt: string | null };

/** The check of a step, with when the request arrived for a work already submitted. */
function opened(checked: Checked, id: string): Promise<Opened> {
  return checked.kind === "ready" && checked.workState === "submitted"
    ? requestedAtOf(id).then((requestedAt) => ({ checked, id, requestedAt }))
    : Promise.resolve({ checked, id, requestedAt: null });
}

/**
 * Step 2, "Izjava" (E-9, WEB-2107), on declaration-v1 (PIL-K-IZJAVA): one createDeclarationStepPorts
 * for both halves of the step, kept for as long as the page is open.
 */
export function DeclarationStepPage({ assignmentId, ports: given }: { assignmentId: string; ports?: StepPorts }) {
  const { base } = useHost();
  const hrefOf = useHrefOf();
  const workHref = useWorkHref(assignmentId);
  const shown = useChecked(assignmentId, "izjava", opened);
  const ports = useMemo(() => given ?? createStepPorts(), [given]);
  return (
    <Shown shown={shown} loading={{ title: stepsText.declarationTitle, message: stepsText.loadingRecorded, label: stepsText.declarationTitle, workHref }}>
      {({ checked, id: assignment, requestedAt }) => (
        <StepsShell step="declaration" work={checked} workHref={workHref} label={stepsText.declarationTitle}
          receiptHref={hrefOf(stepPath(assignment, "potvrda"))} requestedAt={requestedAt} onRetry={shown.reload}>
          {checked.kind === "ready"
            ? <DeclarationStep assignmentId={assignment} workState={checked.workState} ports={ports} hrefOf={hrefOf}
                onSignIn={() => goToSignIn(appHref(base, stepPath(assignment, "izjava")))} />
            : null}
        </StepsShell>
      )}
    </Shown>
  );
}

/** Step 3, "Prije predaje", with the summary and notes from the server; `declaredFor` is the `?izjava=` step 2 handed over. */
export function BeforeSubmitStepPage({ assignmentId, declaredFor }: { assignmentId: string; declaredFor?: string }) {
  const { base } = useHost();
  const hrefOf = useHrefOf();
  const workHref = useWorkHref(assignmentId);
  const shown = useChecked(assignmentId, "pregled", opened);
  return (
    <Shown shown={shown} loading={{ title: stepsText.panelTitle, message: stepsText.loadingWork, label: stepsText.panelLabel, workHref }}>
      {({ checked, id, requestedAt }) => (
        <StepsShell step="beforeSubmit" work={checked} workHref={workHref} label={stepsText.beforeSubmitTitle} wide
          receiptHref={hrefOf(stepPath(id, "potvrda"))} requestedAt={requestedAt} onRetry={shown.reload}>
          <BeforeSubmitStep assignmentId={id} declaredFor={declaredFor} hrefOf={hrefOf} workHref={workHref}
            stage={checked.kind === "ready" ? checked.stage : { kind: "unavailable" }}
            onSignIn={() => goToSignIn(appHref(base, stepPath(id, "pregled")))} />
        </StepsShell>
      )}
    </Shown>
  );
}

/** Step 4, "Predaja"; a submitted work goes on to step 5. */
export function SubmitStepPage({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const { base } = useHost();
  const hrefOf = useHrefOf();
  const workHref = useWorkHref(assignmentId);
  const shown = useChecked(assignmentId, "slanje", async (checked, id) => {
    if (checked.kind === "ready" && checked.stage.kind === "submitted") {
      router.replace(nextPath(base, stepPath(id, "potvrda")));
      return null;
    }
    return { checked, id };
  });
  return (
    <Shown shown={shown} loading={{ title: stepsText.panelTitle, message: stepsText.loadingWork, label: stepsText.panelLabel, workHref }}>
      {({ checked, id }) => (
        <StepsShell step="submit" work={checked} workHref={workHref} label={stepsText.panelLabel}
          receiptHref={hrefOf(stepPath(id, "potvrda"))} onRetry={shown.reload}>
          <SubmitStep assignmentId={id} title={checked.kind === "ready" ? checked.title : ""} dueAt={checked.kind === "ready" ? checked.dueAt : null}
            stage={checked.kind === "ready" ? submitStageOf(checked.workState, checked.dueAt, checked.extendedDueAt, Date.now()) : { kind: "unavailable" }} />
        </StepsShell>
      )}
    </Shown>
  );
}

/** Step 5, "Potvrda": the receipt from the server on every visit, so a reload shows the same receipt. */
export function ReceiptStepPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const router = useRouter();
  const hrefOf = useHrefOf();
  const workHref = useWorkHref(assignmentId);
  const shown = useChecked<{ id: string; receipt: ReceiptRead; course: string; title: string }>(assignmentId, "potvrda", async (checked, id) => {
    const submission = await readSubmittedWork(id, { baseUrl: window.location.origin, fetchImpl: browserTransport })
      .catch(() => ({ kind: "nepoznato" as const }));
    if (submission.kind === "session-expired") {
      goToSignIn(appHref(base, stepPath(id, "potvrda")));
      return null;
    }
    return {
      id, receipt: studentReceiptRead(submission, checked.kind === "ready" ? checked.workState : null),
      course: checked.kind === "ready" ? checked.course : "", title: checked.kind === "ready" ? checked.title : "",
    };
  });
  return (
    <Shown shown={shown} loading={{ title: receiptText.panelTitle, message: receiptText.loading, label: receiptText.label, workHref }}>
      {({ id, receipt, course, title }) => (
        <StepFrame backHref={workHref} onBack={() => router.push(workHref)} course={course} title={title} label={receiptText.label}>
          <ReceiptScreen read={receipt} retryHref={hrefOf(stepPath(id, "potvrda"))} onRetry={shown.reload} workHref={workHref}
            homeHref={hrefOf("/")} checkHref={hrefOf(VERIFY_PATH)} />
          {receipt.kind === "potvrdeno" ? <PortableRecord submissionId={receipt.receipt.payload.submissionId} /> : null}
          {receipt.kind === "potvrdeno" ? <SubmissionPackage assignmentId={id} submissionId={receipt.receipt.payload.submissionId} /> : null}
          <WithdrawSubmission assignmentId={id} />
        </StepFrame>
      )}
    </Shown>
  );
}
