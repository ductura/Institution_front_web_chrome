"use client";

// WEB-2134: the review card "Navodi prema izvoru" (stem.js `RP.PRE.qv`) and the popover text of one quote.
// Evidence is given by the caller (the proofs the student attached, on this device); without it the card says
// the comparison is unavailable instead of guessing. "U redu je ovako" only hides one mismatch for this student.
import { Button } from "@ductura/ui";
import { useMemo, useState } from "react";

import type { CanonicalDocumentV4 } from "../../../../../editor-core/src/document/document/index.ts";
import type { EvidenceBySource } from "./quote-check";
import { dismissKey, reviewQuotes } from "./quote-review";
import { stemHr as t } from "./messages.hr";

export default function QuoteReviewCard({ doc, evidence, dismissed = [], onDismiss }: {
  doc: CanonicalDocumentV4;
  /** The text of attached proofs and notes by source; null when they cannot be read now. */
  evidence: EvidenceBySource | null;
  dismissed?: readonly string[];
  /** Keeps "U redu je ovako" for the student; the card hides the quote meanwhile. */
  onDismiss?: (key: string) => void;
}) {
  const [local, setLocal] = useState<readonly string[]>([]);
  const hidden = useMemo(() => new Set([...dismissed, ...local]), [dismissed, local]);
  const review = useMemo(() => (evidence === null ? null : reviewQuotes(doc, evidence, hidden)), [doc, evidence, hidden]);

  return (
    <section aria-labelledby="stem-qv-title">
      <h3 id="stem-qv-title">{t.review.title}</h3>
      {review === null ? <p role="status">{t.review.unavailable}</p> : (
        <>
          <p role="status">{review.summary}</p>
          {review.open.length > 0 && (
            <ul>
              {review.open.map(({ found, verdict }) => (
                <li key={dismissKey(found)}>
                  <blockquote>„{found.quote}”</blockquote>
                  {verdict.kind !== "none" && verdict.kind !== "ok" && <p>{verdict.message}</p>}
                  {verdict.kind === "differs" && <p>{t.quote.whereAt(verdict.near)}</p>}
                  <p><small>{t.quote.hint}</small></p>
                  <Button tone="quiet" onClick={() => { setLocal((l) => [...l, dismissKey(found)]); onDismiss?.(dismissKey(found)); }}>{t.quote.fine}</Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
