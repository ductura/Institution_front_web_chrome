"use client";

// WEB-2106 (S: E-8, E-9): what steps 2 and 3 of the submission share in the
// prototype: the sticky bar "Natrag na rad" with the path "Kolegij · naslov",
// the steps named "Koraci predaje", and the panels for a work not started, a
// work submitted and a work whose state cannot be read.
import { Button, Card, Steps } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { stepsText as text } from "./messages.hr";
import { pathOf, stepPanelOf, type StepKind, type StepWork } from "./model";
import styles from "./StepsShell.module.css";

export type StepsShellProps = {
  readonly step: StepKind;
  readonly work: StepWork;
  /** Where "Natrag na rad", "Otvori radni prostor" and "Otvori potvrdu o predaji" lead (the host adds its base). */
  readonly workHref: string;
  readonly receiptHref: string;
  readonly onRetry: () => void;
  /** The ordinary step, shown when the work is open for it. */
  readonly children: ReactNode;
};

const CURRENT = { declaration: 2, beforeSubmit: 3 } as const;

function Panel({ title, tag, children }: { title: string; tag: string; children: ReactNode }) {
  return (
    <div className={styles.panel}>
      <Card title={`${title} · ${tag}`}>{children}</Card>
    </div>
  );
}

export default function StepsShell({ step, work, workHref, receiptHref, onRetry, children }: StepsShellProps) {
  const router = useRouter();
  const panel = stepPanelOf(work);
  const body = useRef<HTMLDivElement>(null);
  // The steps of the ordinary step come from a component this lane does not
  // own; name their list here so every step has the same landmark.
  useEffect(() => {
    body.current?.querySelector("ol")?.setAttribute("aria-label", text.stepsLabel);
  });
  return (
    <div>
      <div className={styles.bar}>
        <Button tone="quiet" onClick={() => router.push(workHref)}>{text.backToWork}</Button>
        <p className={styles.path} aria-label={text.pathLabel}>{pathOf(work, text.pathSeparator)}</p>
      </div>
      {panel.kind === "normal" ? <div ref={body}>{children}</div> : (
        <div className="page" ref={body}>
          <Steps currentStep={CURRENT[step]} />
          {panel.kind === "error" && (
            <Card title={text.stepsLabel} error={text.workError}>
              <Button tone="quiet" onClick={onRetry}>{text.retry}</Button>
            </Card>
          )}
          {panel.kind === "notStarted" && (
            <Panel title={text.stepsLabel} tag={text.panelNotStarted}>
              <p role="status">{text.notStarted}</p>
              <Button onClick={() => router.push(workHref)}>{text.openWorkspace}</Button>
            </Panel>
          )}
          {panel.kind === "submitted" && (
            <Panel title={text.stepsLabel} tag={text.panelSubmitted}>
              <p role="status">{step === "declaration" ? text.declarationSubmitted : text.alreadyRequested}</p>
              <Button onClick={() => router.push(receiptHref)}>{text.openReceipt}</Button>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
