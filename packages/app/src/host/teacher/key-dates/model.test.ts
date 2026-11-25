import { describe, expect, it } from "vitest";

import { FAKE_KEY_DATES, fakeKeyDatesPort } from "./fake-port";
import { KINDS, keyDatesView, loadKeyDates, relativeDays, timelineOf, whenOf, type KeyDateEntry } from "./model";

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("key dates", () => {
  it("keeps the closed list of kinds of the server route", () => {
    expect(KINDS).toEqual(["deadline", "milestone", "consultation"]);
  });

  it("sorts rows by date, ascending, with a label from the closed list", () => {
    const v = keyDatesView(FAKE_KEY_DATES);
    expect(v.kind).toBe("ready");
    if (v.kind !== "ready") return;
    expect(v.rows.map((r) => r.id)).toEqual([id(1), id(2), id(3)]);
    expect(v.rows.map((r) => r.label)).toEqual(["Etapa „Nacrt uvoda”", "Rok predaje", "Konzultacije (potvrđene)"]);
    for (let i = 1; i < v.rows.length; i++) expect(v.rows[i]!.epoch).toBeGreaterThanOrEqual(v.rows[i - 1]!.epoch);
  });

  it("reads the date in Zagreb time (winter and summer)", () => {
    expect(whenOf(Date.parse("2026-12-14T22:59:00.000Z"))).toBe("14. 12. 2026. u 23:59");
    expect(whenOf(Date.parse("2026-07-01T10:00:00.000Z"))).toBe("1. 7. 2026. u 12:00");
    const v = keyDatesView({ kind: "ready", dates: [{ id: id(9), kind: "deadline", at: "2026-12-31T23:30:00.000Z" }] });
    expect(v.kind === "ready" && v.rows[0]!.when).toBe("1. 1. 2027. u 00:30");
  });

  it("leaves out unreadable, unknown and repeated entries; ties keep the closed order of kinds", () => {
    const v = keyDatesView({ kind: "ready", dates: [
      { id: id(1), kind: "consultation", at: "2026-12-01T10:00:00.000Z", state: "requested" },
      { id: id(2), kind: "deadline", at: "2026-12-01T10:00:00.000Z" },
      { id: id(2), kind: "deadline", at: "2027-01-01T10:00:00.000Z" },
      { id: id(3), kind: "milestone", at: "nije datum", title: "Izmišljena etapa" },
      { id: id(4), kind: "milestone", at: "2026-12-02T10:00:00.000Z", title: "  " },
      { id: id(5), kind: "opens", at: "2026-12-03T10:00:00.000Z" } as unknown as KeyDateEntry,
      { id: id(6), kind: "consultation", at: "2026-12-04T10:00:00.000Z", state: "cancelled" } as unknown as KeyDateEntry,
    ] });
    expect(v.kind === "ready" && v.rows.map((r) => [r.kind, r.id])).toEqual([["deadline", id(2)], ["consultation", id(1)]]);
    expect(v.kind === "ready" && v.rows[1]!.label).toBe("Konzultacije (zatražene)");
  });

  it("shows no duration, no count and no time left anywhere", () => {
    const v = keyDatesView(FAKE_KEY_DATES);
    expect(JSON.stringify(v)).not.toMatch(/duration|trajanj|visits|posjet|count|total|zbroj|preostal|remaining|još \d|za \d+ dan/i);
  });

  it("maps states; a throwing port is unavailable, never empty", async () => {
    expect(keyDatesView({ kind: "ready", dates: [] }).kind).toBe("empty");
    expect(await loadKeyDates(fakeKeyDatesPort({ kind: "signedOut" }), "m")).toEqual({ kind: "signedOut" });
    expect(await loadKeyDates(fakeKeyDatesPort({ kind: "unavailable" }), "m")).toEqual({ kind: "unavailable" });
    expect(await loadKeyDates({ read: async () => { throw new Error("x"); } }, "m")).toEqual({ kind: "unavailable" });
  });
});

describe("MK-13: days to go or gone, by Zagreb calendar day", () => {
  const noon = Date.parse("2026-12-01T11:00:00.000Z");
  it("counts calendar days, not 24-hour spans", () => {
    expect(relativeDays(Date.parse("2026-12-01T23:30:00.000Z"), noon)).toBe("za 1 dan"); // 00:30 on 2. 12. in Zagreb
    expect(relativeDays(Date.parse("2026-12-01T22:00:00.000Z"), noon)).toBe("danas");
    expect(relativeDays(Date.parse("2026-11-30T12:00:00.000Z"), noon)).toBe("prije 1 dan");
    expect(relativeDays(Date.parse("2026-12-22T12:00:00.000Z"), noon)).toBe("za 21 dan");
    expect(relativeDays(Date.parse("2026-12-12T12:00:00.000Z"), noon)).toBe("za 11 dana");
    expect(relativeDays(Date.parse("2026-11-26T12:00:00.000Z"), noon)).toBe("prije 5 dana");
  });
  it("puts today's dates ahead, never among the missed ones", () => {
    const view = keyDatesView({ kind: "ready", dates: [
      { id: "a", kind: "deadline", at: "2026-12-01T08:00:00.000Z" },
      { id: "b", kind: "milestone", at: "2026-11-30T08:00:00.000Z", title: "Izmišljena etapa" },
    ] });
    if (view.kind !== "ready") throw new Error("ready expected");
    const line = timelineOf(view.rows, noon);
    expect(line.past.map((r) => r.id)).toEqual(["b"]);
    expect(line.ahead.map((r) => [r.id, r.relative])).toEqual([["a", "danas"]]);
    expect(line.today).toBe("Danas je 1. 12. 2026.");
  });
});
