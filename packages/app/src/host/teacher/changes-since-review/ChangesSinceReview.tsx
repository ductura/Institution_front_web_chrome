"use client";

import { useEffect, useState } from "react";
import { Button, Card, Tag } from "@ductura/ui";

import { changeItems, markMessage, markWorkReviewed, reviewLine, type ChangesPort, type ChangesRead } from "./model";
import { changesMessages as text } from "./messages.hr";

/**
 * "Promjene od zadnjeg pregleda" on one work (WEB-1704; M6.7): opens on request and lists the blocks
 * exactly as the server gives them. "Označi kao pregledano" is shown only when the port has the
 * route, and the work counts as reviewed only once the server confirmed it; the list is then read
 * again from the server, never changed on the client's own guess.
 */
export default function ChangesSinceReview({ documentId, port }: { documentId: string; port: ChangesPort }) {
  const [shown, setShown] = useState(false);
  const [read, setRead] = useState<ChangesRead | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!shown) return;
    let active = true;
    void port.read(documentId)
      .then((answer) => { if (active) setRead(answer); })
      .catch(() => { if (active) setRead({ kind: "unavailable" }); });
    return () => { active = false; };
  }, [shown, documentId, port, attempt]);

  const mark = async () => {
    setMarking(true);
    setNote(text.marking);
    const result = await markWorkReviewed(port, documentId);
    setMarking(false);
    setNote(markMessage(result));
    if (result.kind === "marked") setAttempt((n) => n + 1);
  };

  if (!shown) return <Button onClick={() => setShown(true)}>{text.open}</Button>;

  return (
    <Card title={text.title} busy={read === null}>
      {read?.kind === "signedOut" ? <p role="alert">{text.signedOut}</p>
        : read?.kind === "unavailable" ? (
          <>
            <p role="alert">{text.unavailable}</p>
            <Button onClick={() => { setRead(null); setAttempt((n) => n + 1); }}>{text.retry}</Button>
          </>
        ) : read?.kind === "ready" ? (
          <>
            <p>{reviewLine(read.snapshot)}</p>
            {!read.snapshot.changed && <p>{text.none}</p>}
            <ol>
              {changeItems(read.snapshot).map((item) => (
                <li key={item.key} data-change={item.change}>
                  <Tag tone={item.change === "unchanged" ? "neutral" : "accent"}>{item.label}</Tag> {item.text}
                </li>
              ))}
            </ol>
            {port.markReviewed !== undefined && read.snapshot.changed && (
              <Button busy={marking} onClick={() => void mark()}>{text.markReviewed}</Button>
            )}
          </>
        ) : null}
      <p role="status" aria-live="polite">{note}</p>
    </Card>
  );
}
