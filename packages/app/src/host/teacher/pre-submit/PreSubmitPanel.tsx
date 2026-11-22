"use client";

import { Button } from "@ductura/ui";

import type { SummaryOutcome } from "@/client/process-summary";
import { StateBlock, WorkPanel, workPageStyles as styles } from "../n07/WorkPage";
import { fallbackText, preSubmit, type Fallback } from "./model";
import { preSubmitMessages as text } from "./messages.hr";

/** N-07 `pp-h`: what the student saw before submitting (prototype `beforePanel`). Read-only; the full summary is one link away. */
export function PreSubmitPanel({ outcome, summaryHref, onReload }: {
  outcome: SummaryOutcome | null; summaryHref: string; onReload: () => void;
}) {
  const body = outcome?.kind === "ok" ? preSubmit(outcome.summary) : null;
  return (
    <WorkPanel id="pp-h" title={text.title} level={2} busy={outcome === null}>
      {outcome === null && <p className="note" role="status">{text.loading}</p>}
      {outcome !== null && body === null && (
        <>
          <p className="note" role="alert">{text.error}</p>
          <div className={styles.acts}><Button tone="secondary" onClick={onReload}>{text.retry}</Button></div>
        </>
      )}
      {body !== null && (
        <>
          <p className="note">{text.intro}</p>
          <StateBlock title={text.placesHeading}><span>{text.placesUnavailable}</span></StateBlock>
          <StateBlock title={text.pastedHeading}>
            {body.pasted.none !== null ? <span>{body.pasted.none}</span>
              : <ul className={styles.places}>{body.pasted.rows.map((row, i) => <li key={i}>{row}</li>)}</ul>}
          </StateBlock>
          <StateBlock title={text.formHeading}><span>{body.form}</span></StateBlock>
        </>
      )}
      <a href={summaryHref}>{text.fullSummary}</a>
    </WorkPanel>
  );
}

/** N-07 `po-h` variant "nedovrseno": the state the server returns, else an explicit "nedostupno". */
export function FallbackPanel({ fallback }: { fallback: Fallback }) {
  const { title, body } = fallbackText(fallback);
  return (
    <WorkPanel id="po-h" title={title ?? text.fallbackTitle} level={2}>
      <p className="note" role="status">{body}</p>
    </WorkPanel>
  );
}
