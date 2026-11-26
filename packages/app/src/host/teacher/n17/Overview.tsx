"use client";

import { useEffect, useState } from "react";

import { Select } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/shell/nav";
import { goToSignIn } from "../../../../../../src/client/api";
import { useHost } from "../../context";
import { TeacherPage, type TeacherRead } from "../shell/TeacherPage";
import {
  afterDeadlineText, allRows, cardDeadline, filteredRows, groupFilterOptions, stateFilterOptions, type N17StateFilter, deadlineText, loadN17, recordText, revisionText, sortedRows, stateText, summaryLine, timeText,
  unavailablePort, workHref, type N17Card, type N17Port, type N17Row, type N17Read,
} from "./model";
import { n17Messages as text } from "./messages.hr";
import { useNarrow } from "../work/review/CardTable";
import cardStyles from "../work/review/card-table.module.css";

/**
 * N-17 "Zbirni pregled" (WEB-2149): one card per assignment with a meta line and a six-column table,
 * sorted by surname, no ranking and no grade. A failed read says so with a button, never an empty list.
 */
export default function N17Overview({ port = unavailablePort }: { port?: N17Port }) {
  const { base } = useHost();
  const [read, setRead] = useState<N17Read | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stateFilter, setStateFilter] = useState<N17StateFilter>("");
  const [groupFilter, setGroupFilter] = useState("");
  const narrow = useNarrow();

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
  const task = (id: string, rest: string) => appHref(base, `/nastavnik/zadatak/${encodeURIComponent(id)}/${rest}`);
  // NZ-2: the overview of one course (from its card) says so and leads back to all courses.
  const scope = read?.kind === "ready" && read.course !== undefined ? (
    <p className="meta">{text.courseScope(read.course)} <a href={appHref(base, "/nastavnik/zbirni")}>{text.allCourses}</a></p>
  ) : null;
  return (
    <TeacherPage title={text.title} lead={text.lead} loading={text.loading} read={teacherRead} retry={retry}
      unavailable={text.unavailable} retryLabel={text.retry} notice={scope}
      ready={(cards) => cards.length === 0 ? (
        <section className="card center" aria-labelledby="n17-prazno">
          <h2 id="n17-prazno">{text.emptyTitle}</h2>
          <p className="note">{text.emptyBody}</p>
          <a className="btn" href={appHref(base, "/nastavnik/zadatak/novi")}>{text.emptyAction}</a>
        </section>
      ) : (
        <>
          {(() => {
            const rows = allRows(cards);
            const groups = groupFilterOptions(rows);
            const group = groups.some((o) => o.value === groupFilter) ? groupFilter : "";
            return (
              <div className="acts" role="group" aria-label={text.filters.label} data-testid="n17-filters">
                <Select label={text.filters.stateLabel} options={[...stateFilterOptions(rows)]} value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value as N17StateFilter)} />
                {groups.length > 0 && (
                  <Select label={text.filters.groupLabel} options={[...groups]} value={group}
                    onChange={(event) => setGroupFilter(event.target.value)} />
                )}
                {stateFilter !== "" || group !== "" ? (
                  <button type="button" className="btn secondary" onClick={() => { setStateFilter(""); setGroupFilter(""); }}>{text.filters.clear}</button>
                ) : null}
              </div>
            );
          })()}
          {cards.map((card) => { const shown = (rows: readonly N17Row[]) => filteredRows(rows, stateFilter, groupFilter); return (
            <section key={card.assignmentId} className="card" aria-labelledby={`n17-${card.assignmentId}`} data-testid="n17-card">
              <h2 id={`n17-${card.assignmentId}`}>{text.cardTitle(card.courseName, card.title)}</h2>
              {cardDeadline(card, Date.now()) === null ? null : <p className="meta">{cardDeadline(card, Date.now())}</p>}
              <div className="acts" role="group" aria-label={`${text.taskActions}: ${card.title}`}>
                <a className="btn secondary small" href={task(card.assignmentId, "predaje")}>{text.submissions}</a>
                {card.role === "holder" ? <a className="btn secondary small" href={task(card.assignmentId, "produljenje")}>{text.extension}</a> : null}
                {card.role === "holder" ? <a className="btn secondary small" href={task(card.assignmentId, "merlin")}>{text.merlin}</a> : null}
              </div>
              {card.rows === null ? (
                <>
                  <p className="note" role="alert">{text.cardUnavailable}</p>
                  <div className="acts"><button type="button" className="btn secondary" onClick={retry}>{text.retry}</button></div>
                </>
              ) : card.rows.length === 0 ? <p className="note">{text.noStudents}</p> : (
                <>
                  <p className="meta">{summaryLine(card.rows)}</p>
                  {shown(card.rows).length === 0 ? <p className="note" role="status">{text.filters.noMatch}</p> : narrow ? (
                    <ul className={cardStyles.cards} aria-label={text.tableLabel}>
                      {sortedRows(shown(card.rows)).map((row) => {
                        const href = workHref(row);
                        const who = row.name ?? text.noName;
                        const fields: readonly [string, string][] = [
                          [text.columns.state, stateText(row)], [text.columns.submittedAt, timeText(row)], [text.columns.afterDeadline, afterDeadlineText(row)],
                          [text.columns.deadline, deadlineText(row)], [text.columns.record, recordText(row)], [text.columns.revision, revisionText(row)],
                        ];
                        return (
                          <li key={row.studentId} className={`panel ${cardStyles.card}`} data-testid="n17-row-card">
                            <p>{href === null ? who : <a href={appHref(base, href)}>{who}</a>}</p>
                            <dl className={cardStyles.fields}>
                              {fields.map(([name, value]) => (
                                <div key={name} className={cardStyles.field}><dt className="meta">{name}</dt><dd>{value}</dd></div>
                              ))}
                            </dl>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                  <div className="tbl" tabIndex={0} role="region" aria-label={text.tableLabel}>
                    <table>
                      <thead>
                        <tr>{Object.values(text.columns).map((c) => <th key={c} scope="col">{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {sortedRows(shown(card.rows)).map((row) => {
                          const href = workHref(row);
                          const who = row.name ?? text.noName;
                          return (
                            <tr key={row.studentId}>
                              <td>{href === null ? who : <a href={appHref(base, href)}>{who}</a>}</td>
                              <td>{stateText(row)}</td>
                              <td>{timeText(row)}</td>
                              <td>{afterDeadlineText(row)}</td>
                              <td>{deadlineText(row)}</td>
                              <td>{recordText(row)}</td>
                              <td>{revisionText(row)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </>
              )}
            </section>
          ); })}
        </>
      )} />
  );
}
