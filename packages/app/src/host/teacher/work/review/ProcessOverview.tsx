"use client";

import { Button } from "@ductura/ui";
import { useEffect, useState, type ReactNode } from "react";

import { readAssistantMatch, type MatchCall } from "../../provenance/contract";
import type { MatchRead } from "../../provenance/match-model";
import { Kv } from "../../n07/WorkPage";
import { assistantTransfers, sessionsCount } from "../../n10/model";
import { matchPart, matchShareLine, partOf, rhythmLine, ruleLines, type Outcome, type Part } from "./model";
import type { ReviewReads } from "./read";
import { reviewMessages as t } from "./messages.hr";

/** One read per part, each with its own retry; a failed part never hides the others (PG-4). */
function usePart<T>(read: () => Promise<Part<T>>, key: string): [Part<T>, () => void] {
  const [part, setPart] = useState<Part<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setPart({ kind: "loading" });
    void read().then((next) => { if (live) setPart(next); }, () => { if (live) setPart({ kind: "error" }); });
    return () => { live = false; };
    // `read` is rebuilt on every render; the key names what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return [part, () => setAttempt((n) => n + 1)];
}

const asPart = <T,>(outcome: Promise<Outcome<T>>): Promise<Part<T>> => outcome.then(partOf);

/** The block of one part: its heading, then the value, "not given" with its reason, or the error with a retry. */
export function PartBlock<T>({ id, title, part, onRetry, children }: {
  id: string; title: string; part: Part<T>; onRetry: () => void; children: (value: T) => ReactNode;
}) {
  return (
    <section aria-labelledby={id} data-part={id} data-state={part.kind}>
      <h3 id={id}>{title}</h3>
      {part.kind === "ready" ? children(part.value)
        : part.kind === "loading" ? <p className="meta" role="status">{t.partLoading}</p>
        : part.kind === "notGiven" ? <><p className="note">{t.notGiven}</p><p className="meta">{t.notGivenReason}</p></>
        : part.kind === "signedOut" ? <p className="note" role="alert">{t.signedOut}</p>
        : <>
          <p className="note" role="alert">{t.partError(title)}</p>
          <Button tone="secondary" size="small" onClick={onRetry}>{t.retry}</Button>
        </>}
    </section>
  );
}

/**
 * PG-4 "Sažetak" of the work review: record state, the Asistent (counts only, no provider or model, Q-10), the
 * match with an answer of the Asistent, faculty rules and the input rhythm. Every part is read on its own, so
 * "Trenutačno nije dostupno" (the server does not give the part) reads apart from an error with a retry.
 */
export default function ProcessOverview({ documentId, reads, matchCall = readAssistantMatch, summaryHref, declarationHref }: {
  documentId: string; reads: ReviewReads; matchCall?: MatchCall; summaryHref: string; declarationHref: string;
}) {
  const [summary, retrySummary] = usePart(() => asPart(reads.summary(documentId)), `summary:${documentId}`);
  const [details, retryDetails] = usePart(() => asPart(reads.details(documentId)), `details:${documentId}`);
  const [match, retryMatch] = usePart(() => matchCall(documentId).then((r: MatchRead) => matchPart(r)), `match:${documentId}`);
  const [rules, retryRules] = usePart(() => asPart(reads.thresholds(documentId)), `rules:${documentId}`);
  const [rhythm, retryRhythm] = usePart(() => asPart(reads.rhythm(documentId)), `rhythm:${documentId}`);
  const conversations = match.kind === "ready" ? match.value.conversations : null;

  return (
    <div data-review-summary>
      <p className="meta">{t.summaryIntro}</p>
      <PartBlock id="pg-record" title={t.recordHeading} part={summary} onRetry={retrySummary}>
        {(s) => s.sessions.count === 0 && s.pastes.listed.length === 0 && s.gaps.items.length === 0 && s.recordState === "complete"
          ? <p className="note">{t.recordEmpty}</p>
          : <>
            <p>{s.recordState === "complete" ? t.recordComplete : t.recordGaps(s.gaps.items.length)}</p>
            <Kv label={t.sessions}>{sessionsCount(s.sessions.count)}</Kv>
            <p>{t.pastes(s.pastes.listed.length, s.pastes.listedAboveCharacters)}</p>
          </>}
      </PartBlock>
      <PartBlock id="pg-assistant" title={t.assistantHeading} part={details} onRetry={retryDetails}>
        {(d) => <>
          <Kv label={t.assistantTransfers}>{assistantTransfers(d).length}</Kv>
          <Kv label={t.assistantConversations}>{conversations ?? t.notGiven}</Kv>
          <p className="meta">{t.assistantNote}</p>
          <p><a href={declarationHref}>{t.assistantDeclaration}</a></p>
        </>}
      </PartBlock>
      <PartBlock id="pg-match" title={t.matchHeading} part={match} onRetry={retryMatch}>
        {(m) => m.findings === 0 && m.percent <= 0 ? <p>{t.matchNone}</p> : <>
          <p>{t.matchFindings(m.findings)}</p>
          {matchShareLine(m.percent) !== null && <p>{matchShareLine(m.percent)}</p>}
          <p className="note">{t.matchNote}</p>
        </>}
      </PartBlock>
      <PartBlock id="pg-rules" title={t.rulesHeading} part={rules} onRetry={retryRules}>
        {(rows) => rows.length === 0 ? <p className="meta">{t.rulesNone}</p> : <>
          <ul>{ruleLines(rows).map((line) => <li key={line}>{line}</li>)}</ul>
          <p className="meta">{t.rulesNote}</p>
        </>}
      </PartBlock>
      <PartBlock id="pg-rhythm" title={t.rhythmHeading} part={rhythm} onRetry={retryRhythm}>
        {(bursts) => <><p className="note">{rhythmLine(bursts)}</p><p className="meta">{t.rhythmNote}</p></>}
      </PartBlock>
      <p><a href={summaryHref}>{t.summaryFull}</a></p>
    </div>
  );
}
