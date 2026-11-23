"use client";

import { useEffect, useState } from "react";

import { appHref } from "../../../../../../src/components/shell/nav";
import { goToSignIn } from "../../../../../../src/client/api";
import { useHost } from "../../context";
import { TeacherPage, type TeacherRead } from "../shell/TeacherPage";
import { afterDeadlineText, loadN17, recordText, revisionText, sortedRows, stateText, summaryLine, timeText, unavailablePort, workHref, type N17Card, type N17Port, type N17Read } from "./model";
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
  const teacherRead: TeacherRead<readonly N17Card[]> | null = read === null ? null : read.kind === "ready" ? { kind: "ready", value: read.cards } : { kind: read.kind };
  return (
    <TeacherPage title={text.title} lead={text.lead} loading={text.loading} read={teacherRead} retry={retry}
      unavailable={text.unavailable} retryLabel={text.retry}
      ready={(cards) => cards.length === 0 ? (
        <section className="card center" aria-labelledby="n17-prazno">
          <h2 id="n17-prazno">{text.emptyTitle}</h2>
          <p className="note">{text.emptyBody}</p>
          <a className="btn" href={appHref(base, "/nastavnik/novi-zadatak")}>{text.emptyAction}</a>
        </section>
      ) : (
        <>
          {cards.map((card) => (
            <section key={card.assignmentId} className="card" aria-labelledby={`n17-${card.assignmentId}`} data-testid="n17-card">
              <h2 id={`n17-${card.assignmentId}`}>{text.cardTitle(card.courseName, card.title)}</h2>
              {card.rows === null ? (
                <>
                  <p className="note" role="alert">{text.cardUnavailable}</p>
                  <div className="acts"><button type="button" className="btn secondary" onClick={retry}>{text.retry}</button></div>
                </>
              ) : card.rows.length === 0 ? <p className="note">{text.noStudents}</p> : (
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
                              <td>{href === null ? who : <a href={appHref(base, href)}>{who}</a>}</td>
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
        </>
      )} />
  );
}
