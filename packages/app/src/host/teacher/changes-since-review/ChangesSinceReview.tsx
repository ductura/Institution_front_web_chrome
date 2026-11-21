"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import {
  authorLabel, changesSince, kindLabel, markMessage, markWorkReviewed, type ChangesPort, type WorkChange,
} from "./model";
import { changesMessages as text } from "./messages.hr";

type View = { readonly reviewedAt: string | null; readonly changes: readonly WorkChange[] } | "unavailable" | null;

/** "Promjene od zadnjeg pregleda" on one work (WEB-1704; M6.7): opens on request, lists, marks reviewed. */
export default function ChangesSinceReview({ assignmentId, port }: { assignmentId: string; port: ChangesPort }) {
  const [shown, setShown] = useState(false);
  const [view, setView] = useState<View>(null);
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!shown) return;
    let active = true;
    void port.read(assignmentId)
      .then((read) => {
        if (!active) return;
        setView(read.kind === "ready" ? { reviewedAt: read.reviewedAt, changes: read.changes } : "unavailable");
      })
      .catch(() => { if (active) setView("unavailable"); });
    return () => { active = false; };
  }, [shown, assignmentId, port, attempt]);

  const mark = async () => {
    const result = await markWorkReviewed(port, assignmentId);
    setNote(markMessage(result));
    if (result.kind === "marked" && view !== null && view !== "unavailable") setView({ ...view, reviewedAt: result.reviewedAt });
  };

  if (!shown) return <Button onClick={() => setShown(true)}>{text.open}</Button>;

  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      {view === null ? null : view === "unavailable" ? (
        <>
          <p>{text.unavailable}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button>
        </>
      ) : (
        <>
          <p>{view.reviewedAt === null ? text.noReview : `${text.since}: ${view.reviewedAt}`}</p>
          {(() => {
            const list = changesSince(view.reviewedAt, view.changes);
            return list.length === 0 ? <p>{text.none}</p> : (
              <ul>
                {list.map((change) => (
                  <li key={change.id} data-kind={change.kind}>
                    <strong>{kindLabel(change.kind)}</strong> ({authorLabel(change.author)}, {change.at}): {change.text}
                  </li>
                ))}
              </ul>
            );
          })()}
          <Button onClick={() => void mark()}>{text.markReviewed}</Button>
        </>
      )}
      <p role="status" aria-live="polite">{note}</p>
    </section>
  );
}
