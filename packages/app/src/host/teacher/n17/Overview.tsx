"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/shell/nav";
import { goToSignIn } from "../../../../../../src/client/api";
import { useHost } from "../../context";
import { afterDeadlineText, loadN17, recordText, revisionText, sortedRows, stateText, summaryLine, timeText, unavailablePort, workHref, type N17Port, type N17Read } from "./model";
import { n17Messages as text } from "./messages.hr";

/**
 * N-17 "Zbirni pregled" (WEB-2149): one card per assignment with a meta line and a six-column table,
 * sorted by surname, no ranking and no grade. A failed read says so with a button, never an empty list.
 */
export default function N17Overview({ port = unavailablePort }: { port?: N17Port }) {
  const { base } = useHost();
  const [read, setRead] = useState<N17Read | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setRead(null);
    void loadN17(port).then((next) => {
      if (!live) return;
      if (next.kind === "signedOut") goToSignIn(appHref(base, "/nastavnik/zbirni"));
      setRead(next);
    });
    return () => { live = false; };
  }, [port, attempt, base]);

  const retry = () => setAttempt((n) => n + 1);
  return (
    <div className="page">
      <h1>{text.title}</h1>
      <p>{text.lead}</p>
      {read === null && <Skeleton label={text.loading} />}
      {read?.kind === "signedOut" && <p role="status">{text.loading}</p>}
      {read?.kind === "unavailable" && (
        <div>
          <p role="alert">{text.unavailable}</p>
          <button type="button" className="btn" onClick={retry}>{text.retry}</button>
        </div>
      )}
      {read?.kind === "ready" && read.cards.length === 0 && (
        <section className="card" aria-labelledby="n17-prazno">
          <h2 id="n17-prazno">{text.emptyTitle}</h2>
          <p>{text.emptyBody}</p>
          <a className="btn" href={appHref(base, "/nastavnik/novi-zadatak")}>{text.emptyAction}</a>
        </section>
      )}
      {read?.kind === "ready" && read.cards.map((card) => (
        <section key={card.assignmentId} className="card" aria-labelledby={`n17-${card.assignmentId}`} data-testid="n17-card">
          <h2 id={`n17-${card.assignmentId}`}>{text.cardTitle(card.courseName, card.title)}</h2>
          {card.rows === null ? (
            <div>
              <p role="alert">{text.cardUnavailable}</p>
              <button type="button" className="btn" onClick={retry}>{text.retry}</button>
            </div>
          ) : card.rows.length === 0 ? <p>{text.noStudents}</p> : (
            <>
              <p className="meta">{summaryLine(card.rows)}</p>
              <div className="tbl" tabIndex={0} role="region" aria-label={text.tableLabel}>
                <table>
                  <thead>
                    <tr>{Object.values(text.columns).map((c) => <th key={c} scope="col">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {sortedRows(card.rows).map((row) => {
                      const href = workHref(row);
                      const who = row.name ?? text.noName;
                      return (
                        <tr key={row.studentId}>
                          <th scope="row">{href === null ? who : <a href={appHref(base, href)}>{who}</a>}</th>
                          <td>{stateText(row)}</td>
                          <td>{timeText(row)}</td>
                          <td>{afterDeadlineText(row)}</td>
                          <td>{recordText(row)}</td>
                          <td>{revisionText(row)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
