"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { loadHistory, type DocumentHistoryPort, type HistoryView } from "./model";
import { documentHistoryMessages as text } from "./messages.hr";

/**
 * Document history (WEB-1802; M8.13, D-198 t. 6): the list of imports of one work, the same for the
 * student and the teacher. What the file says about itself is marked "tvrdnja iz datoteke".
 */
export default function DocumentHistory({ workId, port }: { workId: string; port: DocumentHistoryPort }) {
  const [view, setView] = useState<HistoryView | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setView(null);
    void loadHistory(port, workId).then((next) => { if (active) setView(next); });
    return () => { active = false; };
  }, [workId, port, attempt]);

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
          <ul>
            {view.rows.map((row) => (
              <li key={row.id} data-import={row.id}>
                <h3>{row.heading}</h3>
                <p>{row.source}</p>
                {row.claims.length === 0 ? <p>{text.noClaims}</p> : (
                  <>
                    <p><em>{text.claimHeading}</em> <small data-claim-badge>({text.claimBadge})</small></p>
                    <ul>{row.claims.map((c) => <li key={c.key} data-claim={c.key}>{c.text}</li>)}</ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
