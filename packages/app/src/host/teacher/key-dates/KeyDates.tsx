"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@ductura/ui";

import { loadKeyDates, type KeyDatesPort, type KeyDatesView } from "./model";
import { keyDatesMessages as text } from "./messages.hr";

/** The key-dates card of a mentorship (WEB-1707; M6.11): dates sorted ascending, nothing counted or timed. */
export default function KeyDates({ mentorshipId, port, title = text.title }: { mentorshipId: string; port: KeyDatesPort; title?: string }) {
  const [view, setView] = useState<KeyDatesView | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setView(null);
    void loadKeyDates(port, mentorshipId).then((next) => { if (active) setView(next); });
    return () => { active = false; };
  }, [mentorshipId, port, attempt]);

  const body = view?.kind === "unavailable"
    ? <><p role="alert">{text.unavailable}</p><Button onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button></>
    : view?.kind === "ready" ? (
      <>
        <p className="note">{text.note}</p>
        <ol data-list="key-dates">
          {view.rows.map((r) => (
            <li key={`${r.kind}:${r.id}`} data-kind={r.kind}>
              <strong>{r.label}: </strong><time dateTime={new Date(r.epoch).toISOString()}>{r.when}</time>
            </li>
          ))}
        </ol>
      </>
    ) : undefined;
  // "empty" passes no content, so the card says text.empty; a failed read is never shown as an empty list.
  return (
    <div data-testid="key-dates" data-state={view?.kind ?? "loading"}>
      <Card title={title} busy={view === null} empty={text.empty} error={view?.kind === "signedOut" ? text.signedOut : undefined}>
        {body}
      </Card>
    </div>
  );
}
