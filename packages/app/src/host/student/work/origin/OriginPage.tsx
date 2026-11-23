"use client";

// PIL-P1-SASTAV-STUDENT: /rad/<assignmentId>/podrijetlo, the student's view of the composition of their own work
// (P-1 rule 2.2: student and teacher see the same). The work's document is found as on the other student pages
// (useWorkDocument): a submitted work names it in the signed receipt; a work in progress reads as unavailable.
import { notFound } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { appHref } from "../../../../../../../src/components/index.ts";
import { assignmentIdOf } from "../../../../../../../src/components/editor/EditorPage.read.ts";
import { goToSignIn } from "../../../../../../../src/client/api.ts";
import { messagesHr as t } from "../../../../../../../src/lib/i18n/messages.hr.ts";

import type { OriginRead } from "../../../teacher/provenance/origin";
import AssistantMatchSection from "../../../teacher/provenance/AssistantMatchSection";
import type { MatchCall } from "../../../teacher/provenance/contract";
import { originText } from "../../../teacher/provenance/origin-messages.hr";
import { hostText } from "../../../../text";
import { useHost } from "../../../context";
import { useWorkDocument } from "../../other";
import { OriginView } from "./OriginView";
import { readOrigin, type OriginReadCall } from "./read";

/** `matchCall` is the port of the assistant match section, as in ProvenanceMap; tests give a fake one. */
export default function OriginPage({ assignmentId: raw, call = readOrigin, matchCall }: { assignmentId: string; call?: OriginReadCall; matchCall?: MatchCall }) {
  const { base } = useHost();
  const work = useWorkDocument(raw, "podrijetlo");
  const [read, setRead] = useState<OriginRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const documentId = work?.kind === "document" ? work.documentId : null;
  useEffect(() => {
    if (documentId === null) return;
    let live = true;
    setRead(null);
    void call(documentId).then((answer) => { if (live) setRead(answer); });
    return () => { live = false; };
  }, [call, documentId, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (work?.kind === "notFound" || read?.kind === "notFound") notFound();
  const id = assignmentIdOf(raw);
  const here = id === null ? "" : appHref(base, `/rad/${encodeURIComponent(id)}/podrijetlo`);
  if (read?.kind === "signedOut") goToSignIn(here);
  const back = id === null ? null : <p><a href={appHref(base, `/rad/${encodeURIComponent(id)}`)}>{t.replay.backToWork}</a></p>;

  let body: ReactNode;
  if (work === null || (work.kind === "document" && (read === null || read.kind === "signedOut"))) {
    body = <p role="status">{hostText.loading}</p>;
  } else if (work.kind === "invalid") {
    body = <p role="status">{t.replay.invalid}</p>;
  } else if (work.kind === "notStarted") {
    body = <p role="status">{t.replay.notStarted}</p>;
  } else if (work.kind !== "document") {
    body = <p role="alert">{originText.unavailable}</p>;
  } else {
    // PIL-P1-PODUDARANJE-KARTA: the same assistant match section as in the teacher's map (P-1 rule 2.2), on the
    // same condition: every answer of the composition (the map's marked and noMarks). The share of the match is
    // the section's own line, so the composition list leaves it out and the line is on the page once.
    const composed = read?.kind === "ready" || read?.kind === "empty";
    body = (
      <>
        <OriginView read={read} onRetry={retry} omit={composed ? "assistant_match" : undefined} />
        {composed && <AssistantMatchSection documentId={work.documentId} call={matchCall} level={2} />}
      </>
    );
  }
  return <div className="page"><h1>{originText.title}</h1>{back}{body}</div>;
}
