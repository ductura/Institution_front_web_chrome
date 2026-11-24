import { pilotMetricsMessages as t } from "./messages.hr";
import type { PilotMetricsData } from "./read";

/**
 * WEB-NUZ-OPERATER (NF-7 OA-1): the only measures the operator's page shows, each an aggregate of
 * ops.pilot-metrics.get. Nothing else of the answer reaches the screen, and the read already refuses
 * an answer outside the contract (an extra field, a person, a count below the group of five).
 */
export const MEASURES = [
  "submissions.recorded", "submissions.notRecorded", "receipts.issued", "receipts.pending",
  "helpRequests.total", "helpRequests.saveProblems", "receiptTime.p50Ms", "receiptTime.p95Ms",
] as const;
export type Measure = (typeof MEASURES)[number];

/** One row of the table: a count, or a time in ms; null is a value the server hides (a group below the minimum). */
export type MeasureRow = { readonly id: Measure; readonly label: string; readonly value: number | null; readonly duration: boolean };

const LABELS: Readonly<Record<Measure, string>> = {
  "submissions.recorded": t.recorded,
  "submissions.notRecorded": t.notRecorded,
  "receipts.issued": t.issued,
  "receipts.pending": t.pending,
  "helpRequests.total": t.help,
  "helpRequests.saveProblems": t.saveProblems,
  "receiptTime.p50Ms": t.median,
  "receiptTime.p95Ms": t.p95,
};

function valueOf(data: PilotMetricsData, id: Measure): number | null {
  switch (id) {
    case "submissions.recorded": return data.submissions.recorded;
    case "submissions.notRecorded": return data.submissions.notRecorded;
    case "receipts.issued": return data.receipts.issued;
    case "receipts.pending": return data.receipts.pending;
    case "helpRequests.total": return data.helpRequests.total;
    case "helpRequests.saveProblems": return data.helpRequests.saveProblems;
    case "receiptTime.p50Ms": return data.receiptTime.p50Ms;
    case "receiptTime.p95Ms": return data.receiptTime.p95Ms;
  }
}

/** The rows of the page, in the order of MEASURES. */
export function measuresOf(data: PilotMetricsData): MeasureRow[] {
  return MEASURES.map((id) => ({ id, label: LABELS[id], value: valueOf(data, id), duration: id.startsWith("receiptTime.") }));
}

/** Nothing recorded yet (OA-12 "prazno"): every count is zero and no time is measured. A hidden value is not empty. */
export function isEmpty(data: PilotMetricsData): boolean {
  return measuresOf(data).every((row) => (row.duration ? row.value === null : row.value === 0));
}
