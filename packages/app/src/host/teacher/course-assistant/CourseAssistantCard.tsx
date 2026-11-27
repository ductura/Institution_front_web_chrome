"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@ductura/ui";

import { courseAssistantMessages as text } from "./messages.hr";
import type { AssistantRead, CourseAssistantPort } from "./port";

type Notice = { readonly tone: "status" | "alert"; readonly line: string };

/**
 * The course's switch of the Asistent (F4-PM1-R07). The state shown is the server's: after a write the
 * answer's `enabled` is shown, after an unconfirmed write the switch is read again, never guessed.
 * A failed read says "unavailable" with a button, never "off".
 */
export default function CourseAssistantCard({ courseId, port, onSignedOut }: {
  courseId: string; port: CourseAssistantPort; onSignedOut?: () => void;
}) {
  const [read, setRead] = useState<AssistantRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let live = true;
    setRead(null);
    void port.read(courseId).catch((): AssistantRead => ({ kind: "unavailable" })).then((next) => {
      if (!live) return;
      if (next.kind === "signedOut") onSignedOut?.();
      setRead(next);
    });
    return () => { live = false; };
  }, [courseId, port, attempt, onSignedOut]);

  const set = async (enabled: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setNotice(null);
    const out = await port.write(courseId, enabled).catch(() => ({ kind: "unknown" as const }));
    inFlight.current = false;
    setWorking(false);
    if (out.kind === "done") {
      setRead({ kind: "ready", enabled: out.enabled });
      setNotice({ tone: "status", line: out.enabled ? text.savedOn : text.savedOff });
    } else if (out.kind === "signedOut") {
      onSignedOut?.();
      setNotice({ tone: "alert", line: text.signedOut });
    } else if (out.kind === "notFound") {
      setRead({ kind: "notFound" });
    } else if (out.kind === "unknown") {
      setNotice({ tone: "alert", line: text.saveUnknown });
      setAttempt((n) => n + 1);
    } else {
      setNotice({ tone: "alert", line: text.saveFailed });
    }
  };

  return (
    <section className="card" aria-labelledby="course-assistant-h" data-testid="course-assistant">
      <h2 id="course-assistant-h">{text.heading}</h2>
      <p className="note">{text.lead}</p>
      {read === null && <p className="note" role="status">{text.loading}</p>}
      {read?.kind === "ready" && (
        <>
          <p className="note" role="status" data-testid="course-assistant-state">{read.enabled ? text.stateOn : text.stateOff}</p>
          <div className="acts">
            <Button tone="secondary" busy={working} disabled={working} onClick={() => void set(!read.enabled)}>
              {read.enabled ? text.turnOff : text.turnOn}
            </Button>
          </div>
        </>
      )}
      {read?.kind === "notFound" && <p className="note" role="alert">{text.notFound}</p>}
      {read?.kind === "signedOut" && <p className="note" role="alert">{text.signedOut}</p>}
      {read?.kind === "unavailable" && (
        <>
          <p className="note" role="alert">{text.unavailable}</p>
          <div className="acts"><Button tone="secondary" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button></div>
        </>
      )}
      {notice !== null && <p className="note" role={notice.tone === "alert" ? "alert" : "status"} data-testid="course-assistant-notice">{notice.line}</p>}
    </section>
  );
}
