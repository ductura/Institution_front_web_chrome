import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { readSubmissionHistory, readWithdrawalSetting, saveWithdrawalSetting } from "./contract";
import { ASSIGNMENT, FAKE_EVENTS, fakeHistoryServer } from "./fake-port";
import { historyText } from "./messages.hr";
import { eventText, eventTime, failureMessage, newestFirst, settingNote } from "./model";

describe("submission history (WEB-1903)", () => {
  it("lists submissions and withdrawals, newest first, equal minutes in a fixed order", async () => {
    const read = await readSubmissionHistory(fakeHistoryServer().call, ASSIGNMENT);
    expect(read.kind).toBe("ready");
    const order = newestFirst(read.kind === "ready" ? read.events : []).map((e) => e.eventId.slice(-2));
    expect(order).toEqual(["e2", "e3", "e1"]);
    expect(eventText(FAKE_EVENTS[0] as never)).toBe("Predano");
    expect(eventText(FAKE_EVENTS[1] as never)).toBe("Povučeno");
    expect(eventTime(FAKE_EVENTS[0] as never)).toContain("2026");
  });

  it("an empty history is a ready empty list; a broken answer is unknown, never empty", async () => {
    expect(await readSubmissionHistory(fakeHistoryServer([]).call, ASSIGNMENT)).toEqual({ kind: "ready", events: [] });
    const extra = async () => ({ ok: true as const, status: 200, body: { events: [{ ...FAKE_EVENTS[0], note: "x" }] } });
    expect(await readSubmissionHistory(extra, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    const dup = async () => ({ ok: true as const, status: 200, body: { events: [FAKE_EVENTS[0], FAKE_EVENTS[0]] } });
    expect(await readSubmissionHistory(dup, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
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
    const stale = async () => ({ ok: true as const, status: 200, body: { enabled: true } });
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
