import { createElement as h } from "react";

import { formatDateTimeHr } from "@/lib/i18n/hr";
import { messagesHr } from "@/lib/i18n/messages.hr";
import { arrangeNotices, type StatusNotices } from "@/lib/status/public-notices";
import type { ComponentName } from "@/lib/status/public-status";

import styles from "./Status.module.css";

const t = messagesHr.statusPage;
const parts = (names: readonly ComponentName[]) => t.affected.replace("{parts}", names.map((n) => t.components[n]).join(", "));
const period = (from: string, to: string) => t.period.replace("{from}", formatDateTimeHr(from)).replace("{to}", formatDateTimeHr(to));

/**
 * WEB-1905: planned maintenance and the outage history, open without sign-in.
 * Pure like StatusView. Shows only times, part names and a fixed kind word:
 * no person, work or address. `now` is passed in so the list is testable.
 */
export default function NoticesView({ notices, now }: { notices: StatusNotices; now: number }) {
  const { maintenance, outages } = arrangeNotices(notices, now);
  const list = (title: string, empty: string, items: ReturnType<typeof h>[]) =>
    h(
      "section",
      { className: styles.panel },
      h("div", { className: styles.top }, h("h2", null, title)),
      h(
        "div",
        { className: styles.body },
        items.length === 0 ? h("p", { className: styles.note }, empty) : h("ul", { className: styles.list }, ...items),
      ),
    );
  return h(
    "div",
    { className: styles.notices },
    list(
      t.maintenanceTitle,
      t.maintenanceNone,
      maintenance.map((e) =>
        h("li", { key: e.id, className: styles.event }, h("span", null, period(e.startsAt, e.endsAt)), h("span", { className: styles.meta }, parts(e.parts))),
      ),
    ),
    list(
      t.outagesTitle,
      t.outagesNone,
      outages.map((e) =>
        h(
          "li",
          { key: e.id, className: styles.event },
          h("span", null, `${t.outageKinds[e.kind]}: ${period(e.startedAt, e.endedAt)}`),
          h("span", { className: styles.meta }, parts(e.parts)),
        ),
      ),
    ),
  );
}
