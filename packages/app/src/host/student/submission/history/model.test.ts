// NF-3 PR-13, PR-15: the student's history read over the contract's own vectors, and the rows of "Moje predaje".
import { describe, expect, it } from "vitest";

import vectors from "../../../../../../../src/client/migration-contract-vectors.generated.json" with { type: "json" };
import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { readStudentHistory, type HistoryCall, type HistoryEvent } from "./contract";
import { historyText } from "./messages.hr";
import { historyRows, lastIsWithdrawal } from "./model";

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const vector = (name: string) => (vectors as { route: string; name: string; response: { status: number; body: unknown } }[])
  .find((v) => v.route === "student.submission-history.get" && v.name === name)!;
const answering = (name: string): HistoryCall => async () => {
  const { status, body } = vector(name).response;
  return status === 200 ? { ok: true, status, body } : { ok: false, status, code: (body as { code: string }).code };
};

describe("student.submission-history.get (PO-38, PO-39)", () => {
  it("reads the contract's history: two submissions, the first withdrawn, and the switch", async () => {
    const read = await readStudentHistory(answering("history"), ASSIGNMENT);
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    expect(read.history.withdrawalAllowed).toBe(true);
    expect(read.history.events.map((e) => e.kind)).toEqual(["submission", "withdrawal", "submission"]);
    const withdrawal = read.history.events[1] as Extract<HistoryEvent, { kind: "withdrawal" }>;
    expect(withdrawal.receipt?.payload.receiptSchema).toBe("ductus-submission-withdrawal-receipt-v1");
  });

  it("reads an empty history and a switched-off withdrawal", async () => {
    expect(await readStudentHistory(answering("empty"), ASSIGNMENT)).toMatchObject({ kind: "ready", history: { withdrawalAllowed: false, events: [] } });
  });

  it("never reads a failure as an empty history", async () => {
    expect(await readStudentHistory(answering("unauthorized"), ASSIGNMENT)).toEqual({ kind: "session-expired" });
    expect(await readStudentHistory(answering("not-found"), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await readStudentHistory(answering("unavailable"), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await readStudentHistory(async () => ({ ok: true, status: 200, body: { withdrawalAllowed: true, events: [] } }), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await readStudentHistory(async () => { throw new Error("offline"); }, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await readStudentHistory(answering("history"), "nije-id")).toEqual({ kind: "nepoznato" });
  });
});

const sub = (attempt: number, id: string, at: string, afterDeadline = false): HistoryEvent =>
  ({ kind: "submission", id, attempt, submissionId: id, revision: attempt + 2, at, afterDeadline });
const wd = (attempt: number, of: string, at: string): HistoryEvent =>
  ({ kind: "withdrawal", id: `${of.slice(0, -2)}ff`, attempt, submissionId: of, revision: attempt + 2, at, receipt: null });
const A = "00000000-0000-4000-8000-0000000000b1";
const B = "00000000-0000-4000-8000-0000000000b2";

describe("Moje predaje (E-11c)", () => {
  it("lists the newest submission first, the one in force and the withdrawn one", async () => {
    const read = await readStudentHistory(answering("history"), ASSIGNMENT);
    if (read.kind !== "ready") throw new Error("ready expected");
    const rows = historyRows(read.history.events);
    expect(rows.map((r) => r.attempt)).toEqual([2, 1]);
    expect(rows[0]).toMatchObject({ line: "Predaja 2, 20. 12. 2026. u 23:05", state: { kind: "current" } });
    expect(rows[1]).toMatchObject({ line: "Predaja 1, 20. 12. 2026. u 22:14", state: { kind: "withdrawn", line: "Povučena 20. 12. 2026. u 22:40." } });
    expect(lastIsWithdrawal(read.history.events)).toBe(false);
  });

  it("marks a late submission and says when the newest event is a withdrawal", () => {
    const events = [sub(1, A, "2026-12-21T10:00:00.000Z", true), wd(1, A, "2026-12-21T11:00:00.000Z")];
    expect(historyRows(events)).toEqual([
      expect.objectContaining({ line: "Predaja 1, 21. 12. 2026. u 11:00, nakon roka", state: { kind: "withdrawn", line: "Povučena 21. 12. 2026. u 12:00.", receipt: null } }),
    ]);
    expect(lastIsWithdrawal(events)).toBe(true);
  });

  it("orders by time whatever order the server lists, and only the newest standing one is in force", () => {
    const rows = historyRows([sub(2, B, "2026-12-02T10:00:00.000Z"), sub(1, A, "2026-12-01T10:00:00.000Z")]);
    expect(rows.map((r) => [r.attempt, r.state.kind])).toEqual([[2, "current"], [1, "earlier"]]);
    expect(historyRows([])).toEqual([]);
  });

  it("holds no forbidden term", () => {
    for (const value of Object.values(historyText)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
