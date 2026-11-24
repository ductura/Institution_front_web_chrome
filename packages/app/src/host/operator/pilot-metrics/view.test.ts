import { describe, expect, it } from "vitest";

import type { PilotMetricsData } from "./read";
import { isEmpty, MEASURES, measuresOf } from "./view";

const full: PilotMetricsData = {
  asOf: "2026-11-20T23:00:00.000Z",
  minimumGroup: 5,
  submissions: { recorded: 10, notRecorded: 5 },
  receipts: { issued: 5, pending: 5 },
  helpRequests: { total: 10, saveProblems: 5 },
  receiptTime: { p50Ms: 3000, p95Ms: 4800 },
};
const none: PilotMetricsData = {
  ...full,
  submissions: { recorded: 0, notRecorded: 0 },
  receipts: { issued: 0, pending: 0 },
  helpRequests: { total: 0, saveProblems: 0 },
  receiptTime: { p50Ms: null, p95Ms: null },
};

describe("mjerila pilota na operaterskoj stranici (WEB-NUZ-OPERATER)", () => {
  it("prikazuje samo osam dopuštenih zbirnih mjerila, redom", () => {
    const rows = measuresOf(full);
    expect(rows.map((row) => row.id)).toEqual([...MEASURES]);
    expect(rows.map((row) => row.value)).toEqual([10, 5, 5, 5, 10, 5, 3000, 4800]);
    expect(rows.filter((row) => row.duration).map((row) => row.id)).toEqual(["receiptTime.p50Ms", "receiptTime.p95Ms"]);
    expect(rows.map((row) => row.label)).toContain("Zabilježene predaje");
  });

  it("ne prenosi ništa izvan popisa mjerila, ni kad bi odgovor nosio više", () => {
    const extra = { ...full, person: "demo-operator", submissions: { ...full.submissions, byCourse: [5] } } as unknown as PilotMetricsData;
    const rows = measuresOf(extra);
    expect(rows).toHaveLength(MEASURES.length);
    expect(JSON.stringify(rows)).not.toMatch(/demo-operator|byCourse/);
  });

  it("zadržava skrivenu vrijednost kao skrivenu", () => {
    const hidden = { ...full, receipts: { issued: null, pending: null } };
    expect(measuresOf(hidden).find((row) => row.id === "receipts.issued")?.value).toBeNull();
  });

  it("prazno je samo kad su svi brojevi nula i nijedno vrijeme nije izmjereno", () => {
    expect(isEmpty(none)).toBe(true);
    expect(isEmpty(full)).toBe(false);
    expect(isEmpty({ ...none, submissions: { recorded: null, notRecorded: 0 } })).toBe(false);
    expect(isEmpty({ ...none, receiptTime: { p50Ms: 1200, p95Ms: null } })).toBe(false);
  });
});
