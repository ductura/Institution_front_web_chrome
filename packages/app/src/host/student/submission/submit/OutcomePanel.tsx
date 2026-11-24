"use client";

// WEB-NUZ-PREDAJA-2 (NF-3 PR-8, PR-9, PR-17): an outcome of the submission the student cannot repeat
// from the same panel is a panel of its own, without "Predaj rad" (prototype outcomePanel()): refused
// (with "Pokušaj ponovno" open only once the device holds nothing unconfirmed), not finished, a newer
// version on the server, not open, and unknown (read again, then "Javi problem").
import { Button, StepActions, StepPanel } from "@ductura/ui";
import type { ReactNode } from "react";

import ProblemReportHelp from "../../../ProblemReportHelp";
import StepLink from "../steps/StepLink";
import { submitText as t } from "./messages.hr";
import { fill, type Line } from "./model";
import { RECHECK_LIMIT, type RecheckState } from "./recheck";
import type { SavedState } from "./use-saved-on-server";

export const OUTCOME_ID = "submission-outcome";
const RETRY_WHY_ID = "submission-retry-why";

export type OutcomePanelProps = {
  readonly line: Line;
  readonly workHref: string;
  readonly declarationHref: string;
  readonly onBack: () => void;
  readonly onReload: () => void;
  readonly onRetry: () => void;
  readonly onCheck: () => void;
  readonly checking: boolean;
  /** PR-9: the rechecks of an unknown outcome. */
  readonly recheck: RecheckState;
  /** PR-8: whether the device still holds text the server has not confirmed. */
  readonly saved: SavedState;
};

export default function OutcomePanel({ line, workHref, declarationHref, onBack, onReload, onRetry, onCheck, checking, recheck, saved }: OutcomePanelProps) {
  const alertAt = line.alertAt ?? line.text.length - 1;
  const lines: ReactNode[] = line.text.map((text, i) => (
    <p key={text} className="note" id={i === 0 ? OUTCOME_ID : undefined} tabIndex={i === 0 ? -1 : undefined} role={i === alertAt ? "alert" : undefined}>{text}</p>
  ));
  const work = <StepLink href={workHref}>{t.openWorkspace}</StepLink>;
  const gaveUp = line.recheck === true && recheck.gaveUp;
  const reading = line.recheck === true && recheck.reading;
  return (
    <StepPanel title={line.title ?? t.panelTitle}>
      {lines}
      {line.offer === "retryWhenSaved" && saved === "saved" && <p className="note" role="status">{t.retryReady}</p>}
      {line.recheck === true && !gaveUp && (
        <p className="meta" role="status">{fill(reading ? t.rechecking : t.recheck, { n: recheck.attempt, limit: RECHECK_LIMIT })}</p>
      )}
      {gaveUp && <p className="note" role="alert">{t.gaveUp}</p>}
      <StepActions>
        {line.offer === "retryWhenSaved" && (
          <Button tone={saved === "saved" ? "primary" : "secondary"} aria-disabled={saved !== "saved" || undefined}
            aria-describedby={saved === "saved" ? undefined : RETRY_WHY_ID} onClick={() => { if (saved === "saved") onRetry(); }}>{t.retryAgain}</Button>
        )}
        {line.offer === "reload" && <Button onClick={onReload}>{t.reload}</Button>}
        {line.offer === "check" && !gaveUp && (
          <Button tone="secondary" busy={checking || reading} onClick={onCheck}>{checking || reading ? t.checking : t.check}</Button>
        )}
        {line.offer === "back" && <Button tone="secondary" onClick={onBack}>{t.back}</Button>}
        {gaveUp && <ProblemReportHelp />}
      </StepActions>
      {line.offer === "retryWhenSaved" && saved !== "saved" && <p className="meta" id={RETRY_WHY_ID}>{saved === "checking" ? t.retryChecking : t.retryWhy}</p>}
      {gaveUp && <p className="meta">{t.reportMeta}</p>}
      {(line.offer === "retryWhenSaved" || line.offer === "reload" || line.offer === "back" || line.offer === "workspace") && work}
      {line.offer === "declaration" && <StepLink href={declarationHref}>{t.openDeclaration}</StepLink>}
    </StepPanel>
  );
}
