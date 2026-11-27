import type { AccessLogDay, AccessLogRow } from "./access-log-days";
import LoadAlert from "@/components/shell/LoadAlert";
import { MONTHS_GENITIVE_HR } from "@/lib/i18n/hr";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

/**
 * DAN-294 (S-42, contract on #1836, c.6814737263): the student's own access
 * log as the server read it. Each stored opening is one row of five minutes
 * under its Zagreb day, the newest first; nothing is summed, counted or timed
 * (D-274 MQ10, PRODUCT §5 rule 17). A reader without a name pair is shown by
 * role alone. No state of its own: the caller gives it the days of one page (readAccessLogPage).
 */

const a = t.accessLog;

/** Design alignment 27. 11. 2026. (S-42): the full month, e.g. "Četvrtak, 26. studenoga 2026.". */
export function dayHeading(day: AccessLogDay): string {
  return `${a.weekdays[day.weekday]}, ${day.day}. ${MONTHS_GENITIVE_HR[day.month - 1]} ${day.year}.`;
}

/**
 * Design alignment 27. 11. 2026. (S-42): name and role are separate parts, 12 px
 * apart, never joined by a dot; a reader without a name pair is the role alone.
 */
export function readerLabel(row: AccessLogRow): readonly string[] {
  if (row.reader === null) return [a.roleAlone[row.role]];
  return [`${row.reader.givenName} ${row.reader.familyName}`, a.roles[row.role]];
}

// `datetime` is the UTC instant: on the autumn change two windows share a Zagreb wall clock.
function Row({ row }: { row: AccessLogRow }) {
  return (
    <li className="access-log__row">
      <time className="access-log__time" dateTime={new Date(row.at).toISOString()}>{`${row.from}–${row.to}`}</time>
      <span className="access-log__who">{readerLabel(row).map((part) => <span key={part}>{part}</span>)}</span>
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

/**
 * Design alignment 27. 11. 2026. (S-42): the one load alert of the app, a role=alert frame
 * with the error edge and text, and "Pokušaj ponovno" as the link under it.
 */
export function AccessLogUnavailable({ retryHref }: { retryHref: string }) {
  return <LoadAlert retry={{ label: a.retry, href: retryHref }}>{a.unavailable}</LoadAlert>;
}
