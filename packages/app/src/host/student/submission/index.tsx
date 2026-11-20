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
import { Steps } from "@ductura/ui";
import { notFound, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { appHref } from "../../../../../../src/components/index.ts";
import { assignmentIdOf, editorWorkRead } from "../../../../../../src/components/editor/EditorPage.read.ts";
import { readSubmittedWork } from "../../../../../../src/components/editor/mentor/work-state/submitted-work-read.ts";
import BeforeSubmit from "../../../../../../src/components/predaja/BeforeSubmit.tsx";
import Declaration from "../../../../../../src/components/predaja/Declaration.tsx";
import { ReceiptPanel, studentReceiptRead, type ReceiptRead } from "../../../../../../src/components/predaja/ReceiptPanel.tsx";
import { stageOf, type Stage } from "../../../../../../src/components/predaja/stage.ts";
import Submission from "../../../../../../src/components/student/Submission.tsx";
import { browserTransport, createApi, goToSignIn } from "../../../../../../src/client/api.ts";
import { messagesHr as t } from "../../../../../../src/lib/i18n/messages.hr.ts";

import { hostText } from "../../../text";
import { useHost } from "../../context";

const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

type Step = "" | "izjava" | "pregled" | "slanje" | "potvrda";

/** What the checked assignment allows a step to show. */
type Checked =
  | { readonly kind: "ready"; readonly title: string; readonly workState: string; readonly stage: Stage }
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
function useChecked<T>(raw: string, step: Step, then: (checked: Checked, assignmentId: string) => Promise<T | null>): Shown<T> {
  const { base } = useHost();
  const router = useRouter();
  const [shown, setShown] = useState<Shown<T>>({ kind: "loading" });
  useEffect(() => {
    let live = true;
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
      if (read.kind === "noticeFirst") return router.replace(appHref(base, `/zadatak/${assignmentId}`));
      if (read.kind === "notFound") return setShown({ kind: "notFound" });
      const checked: Checked = read.kind === "ready"
        ? { kind: "ready", title: read.title, workState: read.workState, stage: stageOf(read.workState, read.dueAt, Date.now()) }
        : { kind: "unavailable" };
      const value = await then(checked, assignmentId);
      if (live && value !== null) setShown({ kind: "ready", value });
    })();
    return () => {
      live = false;
    };
  }, [raw, base]);
  return shown;
}

function Shown<T>({ shown, children }: { shown: Shown<T>; children: (value: T) => ReactNode }) {
  if (shown.kind === "notFound") notFound();
  if (shown.kind === "loading") return <p role="status">{hostText.loading}</p>;
  return <>{children(shown.value)}</>;
}

/** The host's base on every path a step opens. */
function useHrefOf(): (path: string) => string {
  const { base } = useHost();
  return (path) => appHref(base, path);
}

/** `/rad/<id>/predaja`: no screen of its own, only the step the submission stands at. */
export function SubmissionStartPage({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const hrefOf = useHrefOf();
  const shown = useChecked<never>(assignmentId, "", async (checked, id) => {
    const step = checked.kind === "ready" && checked.workState === "submitted" ? "potvrda" : "izjava";
    router.replace(hrefOf(stepPath(id, step)));
    return null;
  });
  return <Shown shown={shown}>{() => null}</Shown>;
}

/** Step 2, "Izjava". The process summary is not in the contract yet and reads as not loadable (§5 rule 11). */
export function DeclarationStepPage({ assignmentId }: { assignmentId: string }) {
  const hrefOf = useHrefOf();
  const shown = useChecked(assignmentId, "izjava", async (checked, id) => ({ checked, id }));
  return (
    <Shown shown={shown}>
      {({ checked, id }) => checked.kind === "ready"
        ? <Declaration assignmentId={id} recorded={{ kind: "error" }} hrefOf={hrefOf} />
        : (
          <div className="page declaration">
            <h1>{t.declaration.title}</h1>
            <p role="status">{t.student.unavailable}</p>
          </div>
        )}
    </Shown>
  );
}

/** Step 3, "Prije predaje"; `declaredFor` is the `?izjava=` step 2 handed over. */
export function BeforeSubmitStepPage({ assignmentId, declaredFor }: { assignmentId: string; declaredFor?: string }) {
  const hrefOf = useHrefOf();
  const shown = useChecked(assignmentId, "pregled", async (checked, id) => ({ checked, id }));
  return (
    <Shown shown={shown}>
      {({ checked, id }) => (
        <BeforeSubmit assignmentId={id} summary={{ kind: "unavailable" }} declaredFor={declaredFor} hrefOf={hrefOf}
          stage={checked.kind === "ready" ? checked.stage : { kind: "unavailable" }} />
      )}
    </Shown>
  );
}

/** Step 4, "Predaja"; a submitted work goes on to step 5. */
export function SubmitStepPage({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const hrefOf = useHrefOf();
  const shown = useChecked(assignmentId, "slanje", async (checked, id) => {
    if (checked.kind === "ready" && checked.stage.kind === "submitted") {
      router.replace(hrefOf(stepPath(id, "potvrda")));
      return null;
    }
    return { checked, id };
  });
  return (
    <Shown shown={shown}>
      {({ checked, id }) => (
        <Submission assignmentId={id} hrefOf={hrefOf} stage={checked.kind === "ready" ? checked.stage : { kind: "unavailable" }} />
      )}
    </Shown>
  );
}

/** Step 5, "Potvrda": the receipt from the server on every visit, so a reload shows the same receipt. */
export function ReceiptStepPage({ assignmentId }: { assignmentId: string }) {
  const { base } = useHost();
  const hrefOf = useHrefOf();
  const shown = useChecked<{ id: string; receipt: ReceiptRead }>(assignmentId, "potvrda", async (checked, id) => {
    const submission = await readSubmittedWork(id, { baseUrl: window.location.origin, fetchImpl: browserTransport })
      .catch(() => ({ kind: "nepoznato" as const }));
    if (submission.kind === "session-expired") {
      goToSignIn(appHref(base, stepPath(id, "potvrda")));
      return null;
    }
    return { id, receipt: studentReceiptRead(submission, checked.kind === "ready" ? checked.workState : null) };
  });
  return (
    <Shown shown={shown}>
      {({ id, receipt }) => (
        <div className="page receipt-page">
          <Steps currentStep={5} />
          <h1>{t.receipt.title}</h1>
          <ReceiptPanel read={receipt} retryHref={hrefOf(stepPath(id, "potvrda"))}
            summaryHref={hrefOf(stepPath(id, "pregled"))} submitHref={hrefOf(stepPath(id, ""))} />
        </div>
      )}
    </Shown>
  );
}
