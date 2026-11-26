// ED-38 (P2-7): counts beside the right panel's cards (prototype right.js `badge`).
// The comments card itself says how many of its comments are open in the text:
// not resolved and placed (a comment whose place was lost is not "here"). The
// right panel only listens; nothing is counted from a guess.
import { createContext, useContext, useEffect } from "react";

import { pluralHr } from "@/lib/i18n/hr";
import { editorPanelLayoutsHr as t } from "@/lib/i18n/messages.hr";

/** Given by the right panel; outside it a report goes nowhere. */
export const OpenCommentsReport = createContext<(count: number) => void>(() => undefined);

/** A comments card reports its open comments; leaving, it takes its count with it. */
export function useReportOpenComments(count: number): void {
  const report = useContext(OpenCommentsReport);
  useEffect(() => { report(count); }, [report, count]);
  useEffect(() => () => report(0), [report]);
}

export function openCommentsLabel(count: number): string {
  const { one, few, many } = t.openComments;
  return pluralHr(count, one, few, many).replace("{count}", String(count));
}
