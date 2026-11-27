"use client";

import { Button } from "@ductura/ui";
import { useEffect, useState } from "react";

import type { SummaryOutcome } from "@/client/process-summary";
import { StateBlock, WorkPanel, workPageStyles as styles } from "../n07/WorkPage";
import type { ElementsRead } from "../text-elements/reader";
import { readSubmittedVersion } from "./read";
import { fallbackText, placesFromRead, preSubmit, type Fallback, type Places } from "./model";
import { preSubmitMessages as text } from "./messages.hr";

/** The open places for a source of one work, read once from the submitted revision through the teacher route (NAS-R20). Without a document id or revision: unavailable. */
export function useOpenPlaces(documentId: string | undefined, revision: number | undefined, read: typeof readSubmittedVersion = readSubmittedVersion): Places {
  const [result, setResult] = useState<ElementsRead | null>(null);
  useEffect(() => {
    if (documentId === undefined || revision === undefined) return;
    let active = true;
    setResult(null);
    void read(documentId, revision).then((next) => { if (active) setResult(next); });
    return () => { active = false; };
  }, [documentId, revision, read]);
  return documentId === undefined || revision === undefined ? { kind: "unavailable" } : placesFromRead(result);
}

/** N-07 `pp-h`: what the student saw before submitting (prototype `beforePanel`). Read-only; the full summary is one link away. */
export function PreSubmitPanel({ outcome, summaryHref, onReload, documentId, revision }: {
  outcome: SummaryOutcome | null; summaryHref: string; onReload: () => void; documentId?: string; revision?: number;
}) {
  const places = useOpenPlaces(documentId, revision);
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
          <StateBlock title={text.placesHeading}><PlacesView places={places} /></StateBlock>
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

export function PlacesView({ places }: { places: Places }) {
  if (places.kind === "places") return <ul className={styles.places}>{places.rows.map((row, i) => <li key={i}>{row}</li>)}</ul>;
  return <span>{places.kind === "loading" ? text.placesLoading : places.kind === "none" ? text.placesNone : text.placesUnavailable}</span>;
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
