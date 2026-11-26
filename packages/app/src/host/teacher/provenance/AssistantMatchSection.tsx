"use client";

import { useEffect, useState } from "react";
import { Button, DataTable, type DataTableColumn } from "@ductura/ui";

import { readAssistantMatch, type MatchCall } from "./contract";
import { matchText as t } from "./match-messages.hr";
import { explainedCount, matchRows, shareLabel, type MatchRead, type MatchRow } from "./match-model";

/** No column sorts: the rows keep the server's order and are never ranked by size. */
const COLUMNS: readonly DataTableColumn<MatchRow>[] = [
  { id: "words", header: t.colWords, cell: (row) => row.words },
  { id: "recorded", header: t.colRecorded, cell: (row) => row.recorded },
  { id: "attached", header: t.colAttached, cell: (row) => row.attached },
  { id: "explanation", header: t.colExplanation, cell: (row) => row.explanation },
];

/**
 * The match with an answer of the assistant inside "Karta podrijetla" (PIL-P1-PODUDARANJE-KARTA; WEB-1230). The
 * student and the teacher see the same section. While the faculty flag is off the server has nothing, and the
 * section does not exist: no heading, no share, no row.
 */
/**
 * `level` is the heading level the parent gives: 3 inside the map panel (default), 2 directly under a page title.
 * `shareListed`: the parent already lists the share of this kind (the student's composition), so it is not repeated.
 */
export default function AssistantMatchSection({ documentId, call = readAssistantMatch, level = 3, shareListed = false }: {
  documentId: string; call?: MatchCall; level?: 2 | 3; shareListed?: boolean;
}) {
  const [read, setRead] = useState<MatchRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRead(null);
    void call(documentId).then((answer) => { if (active) setRead(answer); });
    return () => { active = false; };
  }, [call, documentId, attempt]);
  return <AssistantMatchView read={read} level={level} shareListed={shareListed} onRetry={() => setAttempt((n) => n + 1)} />;
}

/** Loading, none, not found and signed out draw nothing: the surrounding screen already says those. */
export function AssistantMatchView({ read, onRetry, level = 3, shareListed = false }: {
  read: MatchRead | null; onRetry: () => void; level?: 2 | 3; shareListed?: boolean;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  if (read === null || read.kind === "none" || read.kind === "notFound" || read.kind === "signedOut") return null;
  if (read.kind === "unavailable") {
    return (
      <div data-assistant-match="unavailable">
        <p className="note" role="alert">{t.unavailable}</p>
        <Button tone="secondary" onClick={onRetry}>{t.retry}</Button>
      </div>
    );
  }
  return (
    <section aria-labelledby="assistant-match-h" data-assistant-match="ready">
      <Heading id="assistant-match-h">{t.heading}</Heading>
      {!(shareListed && read.percent > 0) && <p data-assistant-match-share><b>{shareLabel(read.percent)}</b></p>}
      <p className="note">{t.intro}</p>
      <p className="note">{t.neutral}</p>
      {read.findings.length > 0 && <p data-assistant-match-explained>{t.explainedOf(explainedCount(read.findings).explained, read.findings.length)}</p>}
      <DataTable caption={t.caption} columns={COLUMNS} rows={matchRows(read.findings)} rowKey={(row) => row.key} empty={t.noConversation} />
    </section>
  );
}
