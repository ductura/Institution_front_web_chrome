// F4-STU-R11 (P-16, INVENTAR-student E-6c): "Što se promijenilo (v1 → v2)" on the notice, from the previous version
// that student.notice.get carries (previousVersion). Three rows as in the prototype: the deadline, the word range and
// the rule on tools. The types are read from the notice view itself, so nothing of the contract is copied here.
import { AI_PURPOSES } from "../../../../../../src/components/teacher/assignment-create.ts";
import type { StudentNoticeRead } from "../../../../../../src/client/student-notice.ts";
import { wordRangeHr } from "../../../../../../src/lib/i18n/length-line.ts";
import { studentHostHr as t } from "../i18n/messages.hr.ts";

import { changesText } from "./messages.hr";
import own from "./HostNotice.module.css";

type NoticeView = Extract<StudentNoticeRead, { kind: "available" }>["view"];
/** The fields of a notice version the table compares; the previous version has at least these. */
export type ComparedVersion = Pick<NoticeView, "versionNo" | "dueAt" | "wordMin" | "wordMax" | "aiPurposes">;

const NONE = "—";

/** The rows of the table, in the prototype's order. `changed` is false when both versions say the same. */
export function noticeChanges(previous: ComparedVersion, current: ComparedVersion, time: (iso: string) => string) {
  const purposes = (version: ComparedVersion) => {
    // The catalogue's purposes are list items ending in ";" or "."; in one cell they are joined with "; ".
    const allowed = AI_PURPOSES.filter((p) => version.aiPurposes.includes(p)).map((p) => t.teacher.tools.purposes[p].replace(/[;.]\s*$/, ""));
    return allowed.length ? changesText.allowed.replace("{purposes}", allowed.join("; ")) : t.student.noTools;
  };
  const words = (version: ComparedVersion) => wordRangeHr({ min: version.wordMin, max: version.wordMax }) ?? NONE;
  return [
    { label: changesText.due, before: time(previous.dueAt), after: time(current.dueAt) },
    { label: changesText.words, before: words(previous), after: words(current) },
    { label: changesText.tools, before: purposes(previous), after: purposes(current) },
  ].map((row) => ({ ...row, changed: row.before !== row.after }));
}

export function NoticeChanges({ previous, current, time }: { previous: ComparedVersion; current: ComparedVersion; time: (iso: string) => string }) {
  const from = String(previous.versionNo);
  const to = String(current.versionNo);
  return (
    <table className={own.changes}>
      <caption>{changesText.caption.replace("{from}", from).replace("{to}", to)}</caption>
      <thead>
        <tr>
          <th scope="col">{changesText.item}</th>
          <th scope="col">{changesText.before.replace("{from}", from)}</th>
          <th scope="col">{changesText.after.replace("{to}", to)}</th>
        </tr>
      </thead>
      <tbody>
        {noticeChanges(previous, current, time).map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.before}</td>
            <td className={row.changed ? own.changed : undefined}>{row.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
