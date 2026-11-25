// ED-16 (NF2-P14): the pure rules of "Povijest i usporedba". A submission is named by its place
// among the submissions ("Predaja 2"), any other saved version by its revision ("Verzija 14").
// When the server holds older versions than the page lists, the place is unknown, so a submission
// is named by its revision too.
import { orderVersions, type Version } from "../../student/time-machine/model";
import { workHistoryHr as t } from "./messages.hr";

export type HistoryRow = { readonly revision: number; readonly name: string; readonly day: string };

/** The rows of the list, newest first. */
export function historyRows(versions: readonly Version[], more = false): readonly HistoryRow[] {
  const ordered = orderVersions(versions);
  const submissions = ordered.filter((v) => v.kind === "submission").map((v) => v.revision).reverse();
  return ordered.map((v) => ({
    revision: v.revision,
    name: v.kind === "submission" && !more ? t.submission(submissions.indexOf(v.revision) + 1) : t.checkpoint(v.revision),
    day: t.day(v.savedMinute),
  }));
}
