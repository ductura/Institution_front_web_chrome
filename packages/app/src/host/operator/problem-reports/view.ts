import { problemReportsMessages as t } from "./messages.hr";
import type { Report } from "./read";

export type ReportRow = {
  readonly reference: string; readonly createdAt: string; readonly category: string; readonly handler: string;
  readonly description: string; readonly status: Report["status"];
};

const CATEGORY = { technical: t.categories.technical.label, course: t.categories.course.label, account: t.categories.account.label } as const;

/** One row per report, newest first. The description is the student's own text; it is shown as plain text only. */
export function reportRows(reports: readonly Report[]): ReportRow[] {
  return [...reports]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({
      reference: r.reference, createdAt: r.createdAt, category: CATEGORY[r.category], handler: t.handlers[r.routedTo],
      description: r.description, status: r.status,
    }));
}
