"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@ductura/ui";

import { loadKeyDates, timelineOf, type KeyDatesPort, type KeyDatesView, type TimelineRow } from "./model";
import { keyDatesMessages as text } from "./messages.hr";

function Rows({ rows, list }: { rows: readonly TimelineRow[]; list: string }) {
  return (
    <ol data-list={list}>
      {rows.map((r) => (
        <li key={`${r.kind}:${r.id}`} data-kind={r.kind}>
          <strong>{r.label}: </strong><time dateTime={new Date(r.epoch).toISOString()}>{r.when}</time> ({r.relative})
        </li>
      ))}
    </ol>
  );
}

/**
 * The timeline of a mentorship (WEB-1707; M6.11; NF-6 MK-13): the same card for the mentor and the student.
 * Dates sorted ascending and split at today (Zagreb), each with "za n dana / prije n dana"; nothing counted or timed.
 * `now` is for tests.
 */
export default function KeyDates({ mentorshipId, port, title = text.title, now = Date.now }:
  { mentorshipId: string; port: KeyDatesPort; title?: string; now?: () => number }) {
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
    : view?.kind === "ready" ? (() => {
      const line = timelineOf(view.rows, now());
      return (
        <div data-list="key-dates">
          <p className="note">{text.note}</p>
          <h3>{text.past}</h3>
          {line.past.length === 0 ? <p>{text.nothingPast}</p> : <Rows rows={line.past} list="past" />}
          <p data-today=""><strong>{line.today}</strong></p>
          <h3>{text.ahead}</h3>
          {line.ahead.length === 0 ? <p>{text.nothingAhead}</p> : <Rows rows={line.ahead} list="ahead" />}
        </div>
      );
    })() : undefined;
  // "empty" passes no content, so the card says text.empty; a failed read is never shown as an empty list.
  return (
    <div data-testid="key-dates" data-state={view?.kind ?? "loading"}>
      <Card level={2} title={title} busy={view === null} empty={text.empty} error={view?.kind === "signedOut" ? text.signedOut : undefined}>
        {body}
      </Card>
    </div>
  );
}
