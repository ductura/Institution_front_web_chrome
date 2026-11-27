// WEB-2113: the student host's own copy of src/components/student/AccessLogView.tsx, on the host catalogue.
import { MONTHS_GENITIVE_HR } from "../../../../../../src/components/i18n/hr.ts";
import { LoadAlert } from "../../states/States";
import type { AccessLogDay, AccessLogRow } from "./days";
import styles from "./AccessLogView.module.css";
import { studentHostHr as t } from "../i18n/messages.hr.ts";

/**
 * DAN-294 (S-42, contract on #1836, c.6814737263): the student's own access
 * log as the server read it. Each stored opening is one row of five minutes
 * under its Zagreb day, the newest first; nothing is summed, counted or timed
 * (D-274 MQ10, PRODUCT §5 rule 17). A reader without a name pair is shown by
 * role alone. No state of its own: the caller gives it the days of one page (readAccessLogPage).
 */

const a = t.accessLog;

export function dayHeading(day: AccessLogDay): string {
  // S-42: the full month name, "Četvrtak, 26. studenoga 2026.".
  return `${a.weekdays[day.weekday]}, ${day.day}. ${MONTHS_GENITIVE_HR[day.month - 1]} ${day.year}.`;
}

/** The reader's text parts: name and role are separate elements (no "·"); a reader without a name is the role alone. */
export function readerParts(row: AccessLogRow): string[] {
  if (row.reader === null) return [a.roleAlone[row.role]];
  return [`${row.reader.givenName} ${row.reader.familyName}`, a.roles[row.role]];
}

export function readerLabel(row: AccessLogRow) {
  return <span className={styles.reader}>{readerParts(row).map((part, i) => <span key={i}>{part}</span>)}</span>;
}

// `datetime` is the UTC instant: on the autumn change two windows share a Zagreb wall clock.
function Row({ row }: { row: AccessLogRow }) {
  return (
    <li className="access-log__row">
      <time className="access-log__time" dateTime={new Date(row.at).toISOString()}>{`${row.from}–${row.to}`}</time>
      {readerLabel(row)}
      <span className="access-log__what">{a.surfaces[row.surface]}</span>
    </li>
  );
}

/**
 * `olderHref` is the next older page when there is one; `newestHref` is set on
 * a continuation, which leads back to the newest days and, when empty, says no
 * older openings exist rather than that the log is empty.
 */
export function AccessLogDays({ days, olderHref, newestHref = null }: { days: AccessLogDay[]; olderHref: string | null; newestHref?: string | null }) {
  const newest = newestHref === null ? null : <p><a className="access-log__more" href={newestHref}>{a.newest}</a></p>;
  if (days.length === 0) {
    return newest === null ? <p className="access-log__note">{a.empty}</p> : <><p className="access-log__note">{a.noOlder}</p>{newest}</>;
  }
  return (
    <>
      {days.map((day) => (
        <section key={day.key} className="access-log__day" aria-labelledby={`dan-${day.key}`}>
          <h2 id={`dan-${day.key}`}>{dayHeading(day)}</h2>
          <ul className="access-log__rows">
            {day.entries.map((row) => <Row key={row.id} row={row} />)}
          </ul>
        </section>
      ))}
      {olderHref === null ? null : (
        // A plain link read on the server; it carries the cursor of the oldest row shown.
        <p><a className="access-log__more" href={olderHref}>{a.older}</a></p>
      )}
      {newest}
    </>
  );
}

/** S-42: the frame in the error colour with "Pokušaj ponovno" under it (the shared LoadAlert). */
export function AccessLogUnavailable({ retryHref }: { retryHref: string }) {
  return <LoadAlert body={a.unavailable} retry={{ label: a.retry, href: retryHref }} />;
}
