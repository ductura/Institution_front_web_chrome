"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { loadWhoOpened, type AccessLogCursor, type WhoOpenedPort, type WhoOpenedView } from "./model";
import { whoOpenedMessages as text } from "./messages.hr";
import { AccessLogDays } from "../../../../../../src/components/student/AccessLogView.tsx";

/** "Tko je otvorio moj rad" (WEB-1707; M10.4): days, one row per five minutes, no total and no duration. */
export default function WhoOpened({ workId, port }: { workId: string; port: WhoOpenedPort }) {
  const [view, setView] = useState<WhoOpenedView | null>(null);
  const [cursor, setCursor] = useState<AccessLogCursor | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setView(null);
    void loadWhoOpened(port, workId, cursor).then((next) => { if (active) setView(next); });
    return () => { active = false; };
  }, [workId, port, cursor, attempt]);

  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      {view === null ? <p role="status">{text.loading}</p> : null}
      {view?.kind === "empty" ? <p>{text.empty}</p> : null}
      {view?.kind === "notFound" ? <p role="status">{text.notFound}</p> : null}
      {view?.kind === "signedOut" ? <p role="alert">{text.signedOut}</p> : null}
      {view?.kind === "unavailable" ? <><p role="alert">{text.unavailable}</p><Button onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button></> : null}
      {view?.kind === "ready" ? (
        <>
          <p>{text.note}</p>
          <AccessLogDays days={[...view.days]} olderHref={null} />
          {view.next === null ? null : <Button onClick={() => setCursor(view.next)}>{text.older}</Button>}
        </>
      ) : null}
    </section>
  );
}
