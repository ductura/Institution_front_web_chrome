import { Button, Select, TextField } from "@ductura/ui";
import { createElement as h } from "react";

import { messagesHr } from "../../../lib/i18n/messages.hr";
import { zagrebParts } from "../../summary/zagreb-time.ts";
import styles from "../StudentWorkspace.module.css";

import type { WorksRead } from "./works-read";
import { filterWorks, rowState, worksOf, yearsOf, type WorkItem, type WorksFilter } from "./works-view";

const t = messagesHr.student.works;
const home = messagesHr.student.home;

function whenHr(iso: string): string {
  const parts = zagrebParts(iso);
  return parts === null ? iso : `${parts.date} ${messagesHr.teacherCourses.at} ${parts.time}`;
}

/** The contract's `2026/2027` as written in Croatian, `2026./2027.`. */
function yearHr(year: string): string {
  const match = /^(\d{4})\/(\d{4})$/.exec(year);
  return match === null ? year : `${match[1]}./${match[2]}.`;
}

/** The state line and the action of a row; no line when the reads prove no state. */
function stateOf(item: WorkItem): { text: string | null; tone: string; action: string } {
  switch (rowState(item)) {
    case "notice":
      return { text: t.state.notice, tone: "wait", action: t.readNotice };
    case "not_started":
      return { text: t.state.notStarted, tone: "idle", action: t.start };
    case "in_progress":
      return { text: t.state.inProgress, tone: "idle", action: t.open };
    case "submitted":
      return { text: t.state.submittedNoTime, tone: "done", action: t.open };
    default:
      return { text: null, tone: "idle", action: t.open };
  }
}

export type MyWorksProps = {
  read: WorksRead;
  filter: WorksFilter;
  /** This page's path: the filter form, retry and sign-in return here. */
  here: string;
  /** Where "Prijava" leads for `here` (AAI@EduHr, D-09). */
  signIn: (returnTo: string) => string;
  /** Where a work opens on this host (`/rad/<id>`). */
  workHref: (assignmentId: string) => string;
};

/**
 * WEB-10 (S: E-4 "Moji radovi", A-10): every assignment of the student's own
 * courses as a row list, with a search and an academic year. The filter is a
 * GET form, so it survives the back button and works without script, and it
 * only narrows what the reads returned. Unavailable is its own alert, never
 * an empty list. Written with `createElement`, so unit tests need no JSX compiler.
 */
export default function MyWorks(props: MyWorksProps) {
  return h("div", { className: styles.page },
    h("header", { className: styles.heading },
      h("h1", { className: styles.title }, t.title),
      props.read.kind === "ready" ? h("p", { className: styles.lede }, t.lede) : null),
    body(props));
}

function body({ read, filter, here, signIn, workHref }: MyWorksProps) {
  if (read.kind === "signedOut") {
    return h("div", { className: styles.state },
      h("p", { role: "status" }, messagesHr.student.assignments.signedOut),
      // An OIDC login (D-09): a real navigation, not a prefetchable Link.
      h("p", null, h("a", { className: "btn", href: signIn(here) }, messagesHr.student.signIn)));
  }
  if (read.kind !== "ready") {
    return h("section", { className: styles.state, role: "alert", "aria-labelledby": "radovi-nedostupno" },
      h("h2", { id: "radovi-nedostupno", className: styles.stateTitle }, home.unavailableHeading),
      h("p", { className: styles.stateBody }, home.unavailableBody),
      // A plain reload: the reads run again on the server.
      h("p", null, h("a", { className: styles.secondary, href: here }, messagesHr.auth.retry)));
  }
  const items = worksOf(read.courses, read.states);
  if (items.length === 0) {
    return h("section", { className: styles.state, "aria-labelledby": "radovi-prazno" },
      h("h2", { id: "radovi-prazno", className: styles.stateTitle }, t.emptyHeading),
      h("p", { className: styles.stateBody }, t.emptyBody),
      h("p", null, h("a", { className: styles.secondary, href: "/upis" }, t.enroll)));
  }
  const shown = filterWorks(items, filter);
  const years = yearsOf(items);
  // A year from the address that the read did not return stays selected, so the form shows what filtered.
  if (filter.year !== "" && !years.includes(filter.year)) years.push(filter.year);
  return h("div", null,
    // Keyed by the filter, so a client navigation does not keep the old default values.
    // autoComplete off: on back the browser would restore text typed before submitting.
    h("form", { key: JSON.stringify([filter.q, filter.year]), className: styles.filter, method: "get", action: here, role: "search" },
      h(TextField, { label: t.search, type: "search", name: "q", defaultValue: filter.q, maxLength: 200, autoComplete: "off", className: styles.field }),
      h(Select, {
        label: t.year, name: "godina", defaultValue: filter.year, autoComplete: "off", className: styles.field,
        placeholder: t.allYears, options: years.map((year) => ({ value: year, label: yearHr(year) })),
      }),
      h(Button, { type: "submit" }, t.apply),
      filter.q !== "" || filter.year !== "" ? h("a", { className: styles.reset, href: here }, t.reset) : null),
    shown.length === 0
      ? h("p", { className: styles.noMatch, role: "status" }, t.noMatch)
      : h("ul", { className: styles.list, "aria-label": t.list }, shown.map((item) => row(item, workHref))));
}

function row(item: WorkItem, workHref: (assignmentId: string) => string) {
  const { text, tone, action } = stateOf(item);
  const id = `rad-${item.assignmentId}`;
  const course = item.academicYear === "" ? item.courseName : `${item.courseName} · ${yearHr(item.academicYear)}`;
  const due = item.extendedDueAt === null
    ? t.due.replace("{time}", whenHr(item.dueAt))
    : home.extendedDue.replace("{time}", whenHr(item.extendedDueAt));
  return h("li", { key: item.assignmentId },
    h("article", { className: styles.item, "aria-labelledby": id },
      h("div", { className: styles.meta },
        h("p", { className: styles.eyebrow }, course),
        h("h2", { id, className: styles.itemTitle }, item.title),
        h("p", { className: styles.facts },
          text === null ? null : h("span", { className: styles.stateText, "data-tone": tone }, text),
          h("span", { className: styles.due }, due))),
      h("a", { className: styles.action, href: workHref(item.assignmentId), "aria-describedby": id }, action)));
}
