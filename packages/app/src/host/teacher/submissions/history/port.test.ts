// PIL-D3-NASTAVNIK: the real port of the history and the switch. Invented ids only.
import { describe, expect, it, vi } from "vitest";

import { readSubmissionHistory, readWithdrawalSetting, saveWithdrawalSetting } from "./contract";
import { ASSIGNMENT, FAKE_EVENTS, STUDENT } from "./fake-port";
import { clientHistoryCall, type HistoryTransport } from "./port";

const answer = (body: unknown) => ({ ok: true as const, status: 200, body });

describe("clientHistoryCall", () => {
  it("reads the history of one student through the contract operation, a withdrawn submission included", async () => {
    const transport = vi.fn<HistoryTransport>(async () => answer({ events: FAKE_EVENTS }));
    const read = await readSubmissionHistory(clientHistoryCall(transport), ASSIGNMENT, STUDENT);
    expect(transport).toHaveBeenCalledWith("teacher.submission-history.get", { params: { assignmentId: ASSIGNMENT, studentId: STUDENT }, query: undefined, body: undefined });
    expect(read.kind === "ready" ? read.events.map((e) => e.kind) : read).toEqual(["submission", "withdrawal", "submission"]);
  });

  it("saves the switch on the server and shows it only from the server's answer", async () => {
    const transport = vi.fn<HistoryTransport>(async () => answer({ allowed: false, changedAt: "2026-12-01T10:00:00.000Z" }));
    expect(await saveWithdrawalSetting(clientHistoryCall(transport), ASSIGNMENT, false)).toEqual({ kind: "spremljeno", enabled: false });
    expect(transport).toHaveBeenCalledWith("teacher.submission-withdrawal.post", { params: { assignmentId: ASSIGNMENT }, query: undefined, body: { allowed: false } });
  });

  it("a refused read is not found; a refused save keeps its 403", async () => {
    const transport = vi.fn<HistoryTransport>(async () => ({ ok: false as const, status: 403, code: "forbidden" }));
    const call = clientHistoryCall(transport);
    expect(await readSubmissionHistory(call, ASSIGNMENT, STUDENT)).toEqual({ kind: "greska", code: "not_found" });
    expect(await readWithdrawalSetting(call, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await saveWithdrawalSetting(call, ASSIGNMENT, true)).toEqual({ kind: "greska", code: "forbidden" });
  });

  it("an ended session reads as such", async () => {
    const call = clientHistoryCall(async () => ({ ok: false, status: 401, code: "unauthorized" }));
    expect(await readWithdrawalSetting(call, ASSIGNMENT)).toEqual({ kind: "session-expired" });
  });
});
