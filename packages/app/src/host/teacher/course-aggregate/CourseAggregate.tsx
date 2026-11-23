"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@ductura/ui";

import { loadAggregate, type AggregateView, type CourseAggregatePort, type CourseAssignment } from "./model";
import { courseAggregateMessages as text } from "./messages.hr";

/**
 * The course aggregate (WEB-1706; M6.10, N-17): shares of a closed list of measures, no names and no
 * scale. Below the threshold the suppressed state is shown instead of any number. The chart has a
 * text alternative and the same numbers are also in the list below it. Practice assignments never enter it (P-D1).
 */
export default function CourseAggregate(
  { courseId, assignments, port, onSignedOut }: {
    courseId: string; assignments: readonly CourseAssignment[]; port: CourseAggregatePort;
    /** Called once a read answers signed out (the page sends the teacher to sign-in). */
    onSignedOut?: () => void;
  },
) {
  const [view, setView] = useState<AggregateView | null>(null);
  const [attempt, setAttempt] = useState(0);
  const signedOut = useRef(onSignedOut);
  useEffect(() => { signedOut.current = onSignedOut; }, [onSignedOut]);

  useEffect(() => {
    let active = true;
    setView(null);
    void loadAggregate(port, courseId, assignments).then((next) => {
      if (!active) return;
      if (next.kind === "signedOut") signedOut.current?.();
      setView(next);
    });
    return () => { active = false; };
  }, [courseId, assignments, port, attempt]);

  const retry = <Button onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button>;

  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      {view === null ? <p role="status">{text.loading}</p> : null}
      {view?.kind === "empty" ? <p>{text.empty}</p> : null}
      {view?.kind === "practiceOnly" ? <p role="status">{text.practiceOnly}</p> : null}
      {view?.kind === "suppressed" ? (
        <div data-state="suppressed" role="status">
          <h3>{text.suppressedTitle}</h3>
          <p>{text.suppressedBody}</p>
        </div>
      ) : null}
      {view?.kind === "signedOut" ? <p role="alert">{text.signedOut}</p> : null}
      {view?.kind === "unavailable" ? <><p role="alert">{text.unavailable}</p>{retry}</> : null}
      {view?.kind === "ready" ? (
        <>
          <p>{text.note}</p>
          {view.practiceLeftOut > 0 ? <p>{text.practiceLeftOut}</p> : null}
          <h3>{text.chartTitle}</h3>
          <div role="img" aria-label={view.chartAlt} data-chart="aggregate">
            {view.measures.map((m) => (
              <div key={m.key} aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ minWidth: 160 }}>{m.label}</span>
                <span style={{ flex: 1, background: "var(--paper-edge, #ddd)", height: 12 }}>
                  {m.shown ? <span style={{ display: "block", width: `${m.percent}%`, height: "100%", background: "var(--gold, #a88a3a)" }} /> : null}
                </span>
                <span>{m.shown ? `${m.percent} %` : text.measureHidden}</span>
              </div>
            ))}
          </div>
          <ul>
            {view.measures.map((m) => (
              <li key={m.key} data-measure={m.key}>
                <strong>{m.label}: </strong>{m.shown ? m.summary : text.measureSuppressedNote}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
