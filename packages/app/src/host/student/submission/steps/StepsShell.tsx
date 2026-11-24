"use client";

// WEB-2106 (S: E-8, E-9) and VIZ-S4: what the steps of the submission share in the prototype: the sticky
// bar "Natrag na rad" with the path "Kolegij · naslov", and the panel for a work not started, a work
// submitted and a work whose state cannot be read (Ductura_student.html, `bar()`, `page()`, `panel()`).
import { Button, StepActions, StepFrame, StepLoading, StepPanel } from "@ductura/ui";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { stepsText as text } from "./messages.hr";
import { pathOf, stepPanelOf, type StepKind, type StepWork } from "./model";
import StepLink from "./StepLink";

export type StepsShellProps = {
  readonly step: StepKind;
  readonly work: StepWork;
  /** Where "Natrag na rad", "Otvori radni prostor" and "Otvori potvrdu o predaji" lead (the host adds its base). */
  readonly workHref: string;
  readonly receiptHref: string;
  /** "5. 11. 2026. u 21:14", when the server names the request time of a submitted work. */
  readonly requestedAt?: string | null;
  readonly onRetry: () => void;
  /** The ordinary step, shown when the work is open for it. */
  readonly children: ReactNode;
  /** The word after the path in the bar for the ordinary step ("Izjava", "Prije predaje"). */
  readonly label: string;
  /** Two columns from 1050 px (E-8). */
  readonly wide?: boolean;
  /** NF-3 PR-16: the teacher's request for revision, after the ordinary step. */
  readonly revision?: ReactNode;
  /** NF-3 PR-14: what follows the panel of a submitted work (the note beside the declaration). */
  readonly submittedExtra?: ReactNode;
};

/** The frame while the work is read: the bar without a path and the loading panel (prototype `ucitavanje`). */
export function StepsLoading({ title, message, workHref, label }: { title: string; message: string; workHref: string; label: string }) {
  const router = useRouter();
  return (
    <StepFrame backHref={workHref} onBack={() => router.push(workHref)} course="" title="" label={label}>
      <StepPanel title={title} busy><StepLoading message={message} /></StepPanel>
    </StepFrame>
  );
}

export default function StepsShell({ step, work, workHref, receiptHref, requestedAt, onRetry, children, label, wide, revision, submittedExtra }: StepsShellProps) {
  const router = useRouter();
  const panel = stepPanelOf(work);
  const path = work.kind === "ready" ? { course: work.course, title: work.title } : { course: "", title: "" };
  const frame = (shown: string, inner: ReactNode, isWide = false) => (
    <StepFrame backHref={workHref} onBack={() => router.push(workHref)} course={path.course} title={path.title} label={shown} wide={isWide}>
      {inner}
    </StepFrame>
  );
  // Only the label of the ordinary step is the step's own; the other panels are "Predaja" in the prototype.
  if (panel.kind === "normal") return frame(label, <>{children}{revision}</>, wide);
  return frame(text.panelLabel, (
    <>
      {panel.kind === "error" && (
        <StepPanel title={text.panelTitle}>
          <p className="note" role="alert">{text.workError}</p>
          <StepActions><Button tone="secondary" onClick={onRetry}>{text.retry}</Button></StepActions>
        </StepPanel>
      )}
      {panel.kind === "notStarted" && (
        <StepPanel title={text.panelTitle}>
          <p className="note">{text.notStarted}</p>
          <StepLink href={workHref}>{text.openWorkspace}</StepLink>
        </StepPanel>
      )}
      {panel.kind === "submitted" && (
        <StepPanel title={text.panelTitle}>
          <p className="note">
            {requestedAt ? text.alreadyRequestedAt.replace("{when}", requestedAt) : text.alreadyRequested}
            {step === "declaration" ? ` ${text.declarationSubmitted}` : ""}
          </p>
          <StepLink href={receiptHref}>{text.openReceipt}</StepLink>
        </StepPanel>
      )}
      {panel.kind === "submitted" && submittedExtra}
    </>
  ));
}
