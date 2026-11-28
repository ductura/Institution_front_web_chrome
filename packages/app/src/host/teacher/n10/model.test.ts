import { describe, expect, it } from "vitest";

import { FAKE_COMPLETE, FAKE_DETAILS, FAKE_EMPTY, FAKE_SUMMARY, FAKE_VERSIONS, fakeN10Port } from "./fake-port";
import {
  assistantAnchor, assistantTransfers, at, characters, duration, isEmpty, loadSummary, pasteAnchor, period, segmentLine,
  sessionLine, sessionsCount, sessionsGenitive, versionLines, type N10Port,
} from "./model";

describe("N-10 loadSummary", () => {
  it("gives the summary with details and versions", async () => {
    const read = await loadSummary(fakeN10Port(), "d1");
    expect(read).toEqual({ kind: "ready", summary: FAKE_SUMMARY, details: FAKE_DETAILS, versions: FAKE_VERSIONS });
  });
  it("is empty when nothing was recorded", async () => {
    expect(isEmpty(FAKE_EMPTY)).toBe(true);
    expect(isEmpty(FAKE_COMPLETE)).toBe(false);
    expect((await loadSummary(fakeN10Port(FAKE_EMPTY), "d1")).kind).toBe("empty");
  });
  it("passes the summary failure through", async () => {
    for (const kind of ["signedOut", "notFound", "unavailable"] as const) {
      expect((await loadSummary(fakeN10Port(kind), "d1")).kind).toBe(kind);
    }
  });
  it("keeps the summary when details or versions are not available", async () => {
    const read = await loadSummary(fakeN10Port(FAKE_SUMMARY, { kind: "unavailable" }, { kind: "unavailable" }), "d1");
    expect(read).toEqual({ kind: "ready", summary: FAKE_SUMMARY, details: null, versions: null });
  });
  it("treats a throwing port as unavailable", async () => {
    const boom = async () => { throw new Error("x"); };
    const port: N10Port = { summary: boom, details: boom, versions: boom };
    expect((await loadSummary(port, "d1")).kind).toBe("unavailable");
  });
});

describe("N-10 text forms", () => {
  it("writes times in the prototype form, Zagreb time", () => {
    expect(at("2026-10-20T16:05:00.000Z")).toBe("20. 10. 2026. u 18:05");
    expect(sessionLine({ from: "2026-10-28T08:30:00.000Z", to: "2026-10-28T09:50:00.000Z" })).toBe("28. 10. 2026., 9:30 do 10:50");
    expect(sessionLine({ from: "2026-10-20T22:50:00.000Z", to: "2026-10-20T23:20:00.000Z" })).toBe("21. 10. 2026., 0:50 do 1:20");
    expect(segmentLine({ from: "2026-10-22T08:35:00.000Z", to: "2026-10-22T08:35:00.000Z" })).toBe("22. 10. 2026., odsječak oko 10:35");
    expect(segmentLine({ from: "2026-10-22T08:35:00.000Z", to: "2026-10-22T08:40:00.000Z" })).toBe("22. 10. 2026., odsječak od 10:35 do 10:40");
  });
  it("counts in Croatian", () => {
    expect([1, 2, 6].map(sessionsCount)).toEqual(["1 sesija", "2 sesije", "6 sesija"]);
    expect(sessionsGenitive(6)).toBe("6 sesija");
    expect([1, 3, 640].map(characters)).toEqual(["1 znak", "3 znaka", "640 znakova"]);
    expect([485, 45, 60].map(duration)).toEqual(["8 h 05 min", "45 min", "1 h 00 min"]);
  });
  it("gives the work period from the sessions", () => {
    expect(period([])).toBeNull();
    expect(period(FAKE_SUMMARY.sessions.items)).toEqual({ from: "2026-10-20T16:05:00.000Z", to: "2026-10-28T09:50:00.000Z" });
  });
  it("lists only submitted versions, oldest first, the newest as submitted", () => {
    expect(versionLines(FAKE_VERSIONS)).toEqual([
      { revision: 1, line: "28. 10. 2026. u 10:50, poslano na pregled" },
      { revision: 4, line: "5. 11. 2026. u 21:14, predano" },
    ]);
    expect(versionLines([])).toEqual([]);
  });
  it("takes only AI transfers from the key events, and names the map anchors", () => {
    const imports = { kind: "import" as const, at: { from: "2026-10-21T08:00:00.000Z", to: "2026-10-21T08:00:00.000Z" } };
    expect(assistantTransfers({ ...FAKE_DETAILS, keyEvents: [imports, ...FAKE_DETAILS.keyEvents] })).toEqual([FAKE_DETAILS.keyEvents[0]!.at]);
    expect([pasteAnchor(0), assistantAnchor(1)]).toEqual(["pv-paste-1", "pv-ai-2"]);
  });
});
