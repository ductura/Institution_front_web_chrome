import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import vectors from "../../../../../../../src/client/migration-contract-vectors.generated.json" with { type: "json" };
import { type HistoryCall, readSubmissionHistory, readWithdrawalSetting, saveWithdrawalSetting } from "./contract";
import { ASSIGNMENT, FAKE_EVENTS, STUDENT, fakeHistoryServer } from "./fake-port";
import { historyText } from "./messages.hr";
import { eventText, eventTime, failureMessage, newestFirst, settingNote } from "./model";

describe("submission history (WEB-1903, LOK-WEB-21)", () => {
  it("reads the server's own history vector for one student, keeping the server's order fields", async () => {
    const vector = (vectors as unknown as { route: string; name: string; request: { params: Record<string, string> }; response: { status: number; body: unknown } }[])
      .find((v) => v.route === "teacher.submission-history.get" && v.name === "history");
    if (vector === undefined) throw new Error("vector missing");
    const asked: unknown[] = [];
    const call: HistoryCall = async (_id, input) => { asked.push(input.params); return { ok: true, status: vector.response.status, body: vector.response.body }; };
    const { assignmentId, studentId } = vector.request.params as { assignmentId: string; studentId: string };
    const read = await readSubmissionHistory(call, assignmentId, studentId);
    expect(asked).toEqual([{ assignmentId, studentId }]);
    if (read.kind !== "ready") throw new Error(read.kind);
    expect(read.events.map((e) => e.kind)).toEqual(["submission", "withdrawal", "submission"]);
    expect(read.events[0]).not.toHaveProperty("receipt");
    expect(read.events[1]).not.toHaveProperty("afterDeadline");
  });

  it("lists submissions and withdrawals, newest first, equal times in a fixed order", async () => {
    const read = await readSubmissionHistory(fakeHistoryServer().call, ASSIGNMENT, STUDENT);
    expect(read.kind).toBe("ready");
    const order = newestFirst(read.kind === "ready" ? read.events : []).map((e) => e.id.slice(-2));
    expect(order).toEqual(["e2", "e3", "e1"]);
    expect(eventText(FAKE_EVENTS[0] as never)).toBe("Predano");
    expect(eventText(FAKE_EVENTS[1] as never)).toBe("Povučeno");
    expect(eventText(FAKE_EVENTS[2] as never)).toBe("Predano (nakon roka)");
    expect(eventTime(FAKE_EVENTS[0] as never)).toContain("2026");
  });

  it("an empty history is a ready empty list; a broken answer is unknown, never empty", async () => {
    expect(await readSubmissionHistory(fakeHistoryServer([]).call, ASSIGNMENT, STUDENT)).toEqual({ kind: "ready", events: [] });
    expect(await readSubmissionHistory(fakeHistoryServer([{ ...FAKE_EVENTS[0], note: "x" }]).call, ASSIGNMENT, STUDENT)).toEqual({ kind: "nepoznato" });
    expect(await readSubmissionHistory(fakeHistoryServer([FAKE_EVENTS[0], FAKE_EVENTS[0]]).call, ASSIGNMENT, STUDENT)).toEqual({ kind: "nepoznato" });
    const noFlag: Record<string, unknown> = { ...FAKE_EVENTS[0] };
    delete noFlag.afterDeadline;
    expect(await readSubmissionHistory(fakeHistoryServer([noFlag]).call, ASSIGNMENT, STUDENT)).toEqual({ kind: "nepoznato" });
    expect(await readSubmissionHistory(fakeHistoryServer().call, ASSIGNMENT, "nije-uuid")).toEqual({ kind: "greska", code: "not_found" });
    const gone = async () => ({ ok: false as const, status: 401, code: "unauthorized" });
    expect(await readSubmissionHistory(gone, ASSIGNMENT, STUDENT)).toEqual({ kind: "session-expired" });
    expect(failureMessage({ kind: "nepoznato" })).toBe(historyText.unavailable);
    expect(failureMessage({ kind: "greska", code: "not_found" })).toBe(historyText.notFound);
  });
});

describe("withdrawal switch", () => {
  it("shows the server's value and saves only what the answer confirms", async () => {
    const server = fakeHistoryServer(FAKE_EVENTS, { enabled: true });
    expect(await readWithdrawalSetting(server.call, ASSIGNMENT)).toEqual({ kind: "ready", enabled: true });
    expect(await saveWithdrawalSetting(server.call, ASSIGNMENT, false)).toEqual({ kind: "spremljeno", enabled: false });
    expect(server.enabled()).toBe(false);
    const stale = async () => ({ ok: true as const, status: 200, body: { allowed: true, changedAt: null } });
    expect(await saveWithdrawalSetting(stale, ASSIGNMENT, false)).toEqual({ kind: "nepoznato" });
  });

  it("names a refusal and hands a lost session back", async () => {
    const server = fakeHistoryServer(FAKE_EVENTS, { forbidSave: true });
    const outcome = await saveWithdrawalSetting(server.call, ASSIGNMENT, false);
    expect(settingNote(outcome)).toEqual({ tone: "alert", text: historyText.settingForbidden });
    expect(settingNote({ kind: "session-expired" })).toBeNull();
    expect(settingNote({ kind: "spremljeno", enabled: true })?.tone).toBe("status");
    const down = async () => { throw new Error("offline"); };
    expect(await saveWithdrawalSetting(down, ASSIGNMENT, true)).toEqual({ kind: "nepoznato" });
  });

  it("holds no forbidden term in its copy", () => {
    for (const value of Object.values(historyText)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
