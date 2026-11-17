// Adapted from Ductus src/components/student/AccessLogView.tsx (DAN-294) for
// DAN-913-2. AccessLogDays and AccessLogUnavailable are one screen here, since
// the catalogue shows every exported screen in five states; the markup of each
// is the same. Written with createElement, like the other screens.
import { createElement as h, Fragment } from "react";

import { messagesHr } from "../../../locales/hr.ts";

import type { AccessLogDay, AccessLogRow } from "./access-log-days";
import styles from "./AccessLogView.module.css";

/**
 * The student's own access log as the server read it (PRODUCT §5 rule 17).
 * Each stored opening is one row of five minutes under its Zagreb day, the
 * newest first; nothing is summed, counted or timed (D-274 MQ10). A reader
 * without a name pair is shown by role alone. No state and no network: the
 * page reads the log and passes the view in.
 */
const a = messagesHr.accessLog;

/**
 * `olderHref` is the next older page when there is one; `newestHref` is set on
 * a continuation, which leads back to the newest days and, when empty, says no
 * older openings exist rather than that the log is empty.
 */
export type AccessLogViewState =
  | { kind: "days"; days: readonly AccessLogDay[]; olderHref: string | null; newestHref?: string | null }
  | { kind: "unavailable"; retryHref: string };

export function dayHeading(day: AccessLogDay): string {
  return `${a.weekdays[day.weekday]}, ${day.day}. ${day.month}. ${day.year}.`;
}

export function readerLabel(row: AccessLogRow): string {
  if (row.reader === null) return a.roleAlone[row.role];
  return `${row.reader.givenName} ${row.reader.familyName} · ${a.roles[row.role]}`;
}

// `dateTime` is the UTC instant: on the autumn change two windows share a Zagreb wall clock.
function row(entry: AccessLogRow) {
  return h("li", { key: entry.id, className: styles.row },
    h("time", { className: styles.time, dateTime: new Date(entry.at).toISOString() }, `${entry.from}–${entry.to}`),
    h("span", null, readerLabel(entry)),
    h("span", { className: styles.what }, a.surfaces[entry.surface]));
}

// A plain link: it carries the cursor of the oldest row shown.
const more = (href: string, text: string) => h("p", null, h("a", { className: styles.more, href }, text));

export default function AccessLogView({ view }: { view: AccessLogViewState }) {
  if (view.kind === "unavailable") {
    return h(Fragment, null,
      h("p", { className: styles.note, role: "alert" }, a.unavailable),
      more(view.retryHref, a.retry));
  }
  const { days, olderHref, newestHref = null } = view;
  const newest = newestHref === null ? null : more(newestHref, a.newest);
  if (days.length === 0) {
    return newest === null
      ? h("p", { className: styles.note }, a.empty)
      : h(Fragment, null, h("p", { className: styles.note }, a.noOlder), newest);
  }
  return h(Fragment, null,
    days.map((day) =>
      h("section", { key: day.key, className: styles.day, "aria-labelledby": `dan-${day.key}` },
        h("h2", { id: `dan-${day.key}` }, dayHeading(day)),
        h("ul", { className: styles.rows }, day.entries.map(row)))),
    olderHref === null ? null : more(olderHref, a.older),
    newest);
}
