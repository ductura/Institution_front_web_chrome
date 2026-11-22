"use client";

import type { SummaryOutcome } from "@/client/process-summary";
import { fallbackText, preSubmit, type Fallback } from "./model";
import { preSubmitMessages as text } from "./messages.hr";

/** N-07 `pp-h`: what the student saw before submitting. Read-only; the full summary is one link away. */
export function PreSubmitPanel({ outcome, summaryHref, onReload }: {
  outcome: SummaryOutcome | null; summaryHref: string; onReload: () => void;
}) {
  const body = outcome?.kind === "ok" ? preSubmit(outcome.summary) : null;
  return (
    <section aria-labelledby="pp-h" className="panel">
      <h2 id="pp-h">{text.title}</h2>
      {outcome === null && <p role="status">{text.loading}</p>}
      {outcome !== null && body === null && (
        <>
          <p role="alert">{text.error}</p>
          <button type="button" className="btn secondary" onClick={onReload}>{text.retry}</button>
        </>
      )}
      {body !== null && (
        <>
          <p className="note">{text.intro}</p>
          <div><strong>{text.placesHeading}</strong><p>{text.placesUnavailable}</p></div>
          <div>
            <strong>{text.pastedHeading}</strong>
            {body.pasted.none !== null ? <p>{body.pasted.none}</p>
              : <ul>{body.pasted.rows.map((row, i) => <li key={i}>{row}</li>)}</ul>}
          </div>
          <div><strong>{text.formHeading}</strong><p>{body.form}</p></div>
        </>
      )}
      <a href={summaryHref}>{text.fullSummary}</a>
    </section>
  );
}

/** N-07 `po-h` variant "nedovrseno": the state the server returns, else an explicit "nedostupno". */
export function FallbackPanel({ fallback }: { fallback: Fallback }) {
  const { title, body } = fallbackText(fallback);
  return (
    <section aria-labelledby="po-fallback-h" className="panel">
      <h2 id="po-fallback-h">{title ?? text.fallbackTitle}</h2>
      <p className="note" role="status">{body}</p>
    </section>
  );
}
