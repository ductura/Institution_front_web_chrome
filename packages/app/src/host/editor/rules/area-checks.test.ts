import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { AREA_CHECKS, areaChecksOf } from "./area-checks";
import { AREA_ORDER, PROFILES } from "./profiles";
import { countsOf, itemsOf, setupOf, toggleTick } from "./rules-model";

const areaItems = (id: string) => itemsOf(PROFILES.find((p) => p.id === id)!, null).filter((i) => i.key.startsWith("area:"));

describe("area checks", () => {
  it("gives every entry a unique key and a text", () => {
    for (const list of Object.values(AREA_CHECKS)) {
      expect(new Set(list.map((c) => c.key)).size).toBe(list.length);
      for (const c of list) {
        expect(c.key).toMatch(/^[a-z]+$/);
        expect(c.text.trim().length).toBeGreaterThan(0);
      }
    }
    expect(AREA_CHECKS.dru?.length).toBe(4);
  });
  it("lists only the dru area", () => {
    expect(Object.keys(AREA_CHECKS)).toEqual(["dru"]);
    for (const area of AREA_ORDER.filter((a) => a !== "dru")) expect(areaChecksOf(area)).toEqual([]);
    const other = PROFILES.filter((p) => setupOf(p).area !== "dru");
    expect(other.length).toBeGreaterThan(0);
    for (const p of other) expect(itemsOf(p, null).some((i) => i.key.startsWith("area:")), p.id).toBe(false);
  });
  it("mounts the list as manual ticks, with no verdict about the work", () => {
    const items = areaItems("df-opci");
    expect(items.map((i) => i.title)).toEqual(AREA_CHECKS.dru!.map((c) => c.text));
    for (const i of items) expect([i.group, i.state, i.detail]).toEqual(["manual", "tick", ""]);
    expect(itemsOf(PROFILES.find((p) => p.id === "df-opci")!, null).filter((i) => i.key.startsWith("area:"))).toHaveLength(4);
  });
  it("counts a tick only when the student sets it, per profile", () => {
    const profile = PROFILES.find((p) => p.id === "df-opci")!;
    const items = itemsOf(profile, null);
    const before = countsOf(items, {});
    const ticks = toggleTick({}, profile.id, "area:method");
    expect(ticks[profile.id]!["area:method"]).toBe(true);
    expect(countsOf(items, ticks[profile.id]!).ok).toBe(before.ok + 1);
    expect(countsOf(items, {}).ok).toBe(before.ok);
  });
  it("does not repeat a check the profile already lists", () => {
    const text = AREA_CHECKS.dru![0]!.text.toLowerCase().replace(/\.$/, "");
    expect(areaChecksOf("dru", [text]).map((c) => c.key)).not.toContain("method");
    expect(areaChecksOf("dru", [text])).toHaveLength(3);
  });
  it("avoids forbidden words and any network call", () => {
    const text = JSON.stringify(AREA_CHECKS).toLowerCase();
    for (const w of ["plagijat", "izvornost", "detektor", "varanje", "autorstv"]) expect(text, w).not.toContain(w);
    const code = readFileSync(new URL("./area-checks.ts", import.meta.url), "utf8");
    expect(code).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\b|\/api\/v\d/);
  });
});
