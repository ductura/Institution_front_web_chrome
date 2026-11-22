// Ported from Ductus src/components/teacher/MentoredWorks.tsx at 9c45857
// (DAN-871, 871-2). Only two things differ: the imports, and next/link, which
// the web does not have, is a plain "a" without prefetch, as in AppShell.
import { createElement as h, Fragment } from "react";

import { messagesHr } from "../../../locales/hr.ts";

import type { MentoredWork } from "./mentored-works-read";

import { byFamilyName, liveHref, stateText, studentName, workTypeText } from "./mentored-works-view";
import styles from "./MentoredWorks.module.css";

const t = messagesHr.mentoredWorks;

/**
 * DAN-492 (M2.6-P02, N-16), design pregled-radova-v2, the list only: one row
 * per open mentorship with the student, the title and type of the work and
 * its state in words. Only what the read gives is drawn (D-202): no time,
 * stage, rubric or grade. A started work links to the live view; a work not
 * yet started has no link and says so.
 *
 * Written with `createElement`, not JSX, like TeacherCourses: the unit tests
 * render it without the Next.js compiler (`jsx: preserve`).
 */
export default function MentoredWorks({ works }: { works: readonly MentoredWork[] }) {
  if (works.length === 0) {
    return h("section", { className: styles.empty, "aria-labelledby": "bez-mentorstava" },
      h("h2", { id: "bez-mentorstava" }, t.empty),
      h("p", null, t.emptyHint));
  }
  return h(Fragment, null,
    h("section", { className: styles.list, "aria-labelledby": "radovi-abecedno" },
      h("h2", { id: "radovi-abecedno", className: styles.listTitle }, t.listTitle),
      h("ul", { className: styles.works },
        byFamilyName(works).map((work) => {
          const href = liveHref(work);
          const type = workTypeText(work);
          return h("li", { key: work.mentorshipId, className: styles.work },
            h("span", { className: styles.name }, studentName(work)),
            h("span", { className: styles.title }, work.title),
            h("span", { className: styles.meta }, type === "" ? stateText(work) : `${type} · ${stateText(work)}`),
            href === null ? null : h("a", { className: styles.open, href }, t.open));
        }))),
    h("p", { className: styles.note }, t.orderNote));
}
