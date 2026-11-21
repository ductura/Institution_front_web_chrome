import { describe, expect, it } from "vitest";

import { FAKE_KEY_DATES } from "./fake-port";
import { fakeKeyDatesPort } from "./fake-port";
import { keyDatesView, loadKeyDates, whenOf } from "./model";

describe("key dates", () => {
  it("sorts rows by date, ascending", () => {
    const v = keyDatesView(FAKE_KEY_DATES);
    expect(v.kind).toBe("ready");
    if (v.kind !== "ready") return;
    expect(v.rows.map((r) => r.id)).toEqual(["d1", "d2", "d3"]);
    for (let i = 1; i < v.rows.length; i++) expect(v.rows[i]!.epoch).toBeGreaterThanOrEqual(v.rows[i - 1]!.epoch);
  });

  it("reads the date in Zagreb time", () => {
    expect(whenOf(Date.parse("2026-12-14T22:59:00.000Z"))).toBe("14. 12. 2026. u 23:59");
    expect(whenOf(Date.parse("2026-07-01T10:00:00.000Z"))).toBe("1. 7. 2026. u 12:00");
  });

  it("leaves out unreadable and repeated entries; ties keep a closed order", () => {
    const v = keyDatesView({ kind: "ready", dates: [
      { id: "a", kind: "deadline", at: "2026-12-01T10:00:00.000Z" },
      { id: "b", kind: "opens", at: "2026-12-01T10:00:00.000Z" },
      { id: "a", kind: "review", at: "2027-01-01T10:00:00.000Z" },
      { id: "x", kind: "opens", at: "nije datum" },
    ] });
    expect(v.kind === "ready" && v.rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("shows no duration and no count anywhere", () => {
    const v = keyDatesView(FAKE_KEY_DATES);
    expect(JSON.stringify(v)).not.toMatch(/duration|trajanj|visits|posjet|count|total|zbroj/i);
  });

  it("maps states; a throwing port is unavailable", async () => {
    expect(keyDatesView({ kind: "ready", dates: [] }).kind).toBe("empty");
    expect(await loadKeyDates(fakeKeyDatesPort({ kind: "signedOut" }), "m")).toEqual({ kind: "signedOut" });
    expect(await loadKeyDates({ read: async () => { throw new Error("x"); } }, "m")).toEqual({ kind: "unavailable" });
  });
});
