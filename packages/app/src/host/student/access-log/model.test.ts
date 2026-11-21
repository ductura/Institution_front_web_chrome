import { describe, expect, it } from "vitest";

import { FAKE_ENTRIES, fakeWhoOpenedPort } from "./fake-port";
import { loadWhoOpened, whoOpenedView } from "./model";

describe("who opened my work", () => {
  it("groups by Zagreb day, newest first, one five-minute row per opening", () => {
    const v = whoOpenedView({ kind: "ok", entries: FAKE_ENTRIES, next: null });
    expect(v.kind).toBe("ready");
    if (v.kind !== "ready") return;
    expect(v.days.map((d) => d.key)).toEqual(["2026-11-10", "2026-11-08"]);
    expect(v.days[0]!.entries.map((r) => [r.from, r.to])).toEqual([["14:15", "14:20"], ["14:10", "14:15"]]);
  });

  it("never merges rows and carries no total, duration or visit count", () => {
    const v = whoOpenedView({ kind: "ok", entries: FAKE_ENTRIES, next: null });
    expect(v.kind === "ready" && v.days.reduce((n, d) => n + d.entries.length, 0)).toBe(3);
    expect(Object.keys(v).sort()).toEqual(["days", "kind", "next"]);
    expect(JSON.stringify(v)).not.toMatch(/duration|trajanj|visits|posjet|total|zbroj|count/i);
  });

  it("maps states; a throwing port is unavailable", async () => {
    expect(whoOpenedView({ kind: "ok", entries: [], next: null }).kind).toBe("empty");
    expect((await loadWhoOpened(fakeWhoOpenedPort({ kind: "notFound" }), "w")).kind).toBe("notFound");
    expect(await loadWhoOpened({ read: async () => { throw new Error("x"); } }, "w")).toEqual({ kind: "unavailable" });
  });
});
