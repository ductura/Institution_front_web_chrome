"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { loadKeyDates, type KeyDatesPort, type KeyDatesView } from "./model";
import { keyDatesMessages as text } from "./messages.hr";

/** The key-dates card of a mentorship (WEB-1707; M6.11): dates sorted ascending, nothing counted or timed. */
export default function KeyDates({ mentorshipId, port }: { mentorshipId: string; port: KeyDatesPort }) {
  const [view, setView] = useState<KeyDatesView | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setView(null);
    void loadKeyDates(port, mentorshipId).then((next) => { if (active) setView(next); });
    return () => { active = false; };
  }, [mentorshipId, port, attempt]);

  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      {view === null ? <p role="status">{text.loading}</p> : null}
      {view?.kind === "empty" ? <p>{text.empty}</p> : null}
      {view?.kind === "signedOut" ? <p role="alert">{text.signedOut}</p> : null}
      {view?.kind === "unavailable" ? <><p role="alert">{text.unavailable}</p><Button onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button></> : null}
      {view?.kind === "ready" ? (
        <>
          <p>{text.note}</p>
          <ol data-list="key-dates">
            {view.rows.map((r) => (
              <li key={r.id} data-kind={r.kind}>
                <strong>{r.label}: </strong><time dateTime={new Date(r.epoch).toISOString()}>{r.when}</time>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}
