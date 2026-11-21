"use client";

import { useState } from "react";
import { Button } from "@ductura/ui";

import { canRestore, restoreRevision, type RestoreOutcome, type RestorePort } from "./model";
import { restoreMessages as text } from "./messages.hr";

type Phase = { kind: "idle" } | { kind: "confirm"; revision: number } | { kind: "restoring" } | RestoreOutcome;

/**
 * Restore the student's own earlier text (WEB-1907; P-D7). The chosen revision is saved as a new
 * one through the editor's save path; nothing in the history is removed.
 */
export default function RestoreRevision(props: {
  documentId: string;
  revisions: readonly number[];
  currentRevision: number;
  port: RestorePort;
  onRestored?: (revision: number) => void;
}) {
  const { documentId, revisions, currentRevision, port, onRestored } = props;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const run = async (revision: number) => {
    setPhase({ kind: "restoring" });
    const outcome = await restoreRevision(port, { documentId, revision, currentRevision });
    setPhase(outcome);
    if (outcome.kind === "done") onRestored?.(outcome.revision);
  };

  const older = [...new Set(revisions)].filter((r) => canRestore(r, currentRevision)).sort((a, b) => b - a);
  const busy = phase.kind === "restoring";

  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      <p>{text.note}</p>
      <p>{text.current}: {text.version(currentRevision)}</p>
      <ul>
        {older.map((revision) => (
          <li key={revision} data-revision={revision}>
            {text.version(revision)}{" "}
            <Button disabled={busy} onClick={() => setPhase({ kind: "confirm", revision })}>{text.restore}</Button>
          </li>
        ))}
      </ul>
      {phase.kind === "confirm" ? (
        <div role="alertdialog" aria-label={text.title}>
          <p>{text.confirm(phase.revision)}</p>
          <Button onClick={() => void run(phase.revision)}>{text.confirmYes}</Button>{" "}
          <Button onClick={() => setPhase({ kind: "idle" })}>{text.confirmNo}</Button>
        </div>
      ) : null}
      {busy ? <p role="status">{text.restoring}</p> : null}
      {phase.kind === "done" ? <p role="status">{text.done(phase.from, phase.revision)}</p> : null}
      {phase.kind === "conflict" || phase.kind === "notFound" || phase.kind === "signedOut" || phase.kind === "unavailable" ? (
        <p role="alert">{text[phase.kind]}</p>
      ) : null}
    </section>
  );
}
