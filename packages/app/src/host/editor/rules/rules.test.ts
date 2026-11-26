import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PROFILES, UNITS, AREA_ORDER, profileById, profilesOf } from "./profiles";
import { RulesHost } from "./RulesHost";
import { cardLine, countsOf, itemsOf, setupOf, tableRow, toggleTick, unitsByArea, type WorkStats } from "./rules-model";
import { rulesHr } from "./messages.hr";

const full = profileById("df-diplomski")!;
const stats = (over: Partial<WorkStats> = {}): WorkStats => ({ words: 11000, references: 16, books: 3, chapters: { uvod: 900, "zaključak": 400 }, ...over });

describe("profiles", () => {
  it("every profile names a known unit and every unit has a profile", () => {
    for (const p of PROFILES) expect(UNITS.some((u) => u.id === p.unitId), p.id).toBe(true);
    for (const u of UNITS) expect(profilesOf(u.id).length, u.id).toBeGreaterThan(0);
    expect(new Set(PROFILES.map((p) => p.id)).size).toBe(PROFILES.length);
  });
  it("has a unit in each of the seven areas", () => {
    for (const area of AREA_ORDER) expect(UNITS.some((u) => u.area === area), area).toBe(true);
  });
});

describe("setupOf", () => {
  it("takes style from the rule, else the study exception, else the area", () => {
    expect(setupOf(full)).toMatchObject({ area: "dru", style: "apa", source: "rule" });
    expect(setupOf(profileById("df-opci")!)).toMatchObject({ style: "apa", source: "area" });
    expect(setupOf(profileById("pr-diplomski")!).source).toBe("own");
  });
  it("adds tools by area, unit and study", () => {
    expect(setupOf(profileById("rf-informatika")!).tools).toEqual(expect.arrayContaining(["formula", "code"]));
    expect(setupOf(profileById("pf-kemija")!).tools).toContain("chem");
    expect(setupOf(profileById("df-opci")!).tools).toEqual([]);
  });
});

describe("itemsOf", () => {
  it("waits for the text while the work is unread", () => {
    const items = itemsOf(full, null);
    expect(items.find((i) => i.key === "scope")?.state).toBe("waiting");
    expect(items.find((i) => i.key === "refs")?.state).toBe("waiting");
  });
  it("marks scope, sources and chapters from the stats", () => {
    const ok = itemsOf(full, stats());
    expect(ok.find((i) => i.key === "scope")).toMatchObject({ state: "ok", title: "Opseg: 10000 do 12000 riječi" });
    const low = itemsOf(full, stats({ words: 500, references: 3, chapters: { uvod: 0 } }));
    expect(low.find((i) => i.key === "scope")?.state).toBe("todo");
    expect(low.find((i) => i.key === "refs")?.state).toBe("todo");
    expect(low.find((i) => i.key === "uvod")).toMatchObject({ state: "todo", detail: "Naslov postoji, teksta još nema." });
    expect(low.find((i) => i.key === "zaključak")).toMatchObject({ state: "todo", detail: "Poglavlje još ne postoji." });
  });
  it("says the teacher sets the scope when the profile has none", () => {
    const item = itemsOf(profileById("df-opci")!, stats()).find((i) => i.key === "scope")!;
    expect(item).toMatchObject({ group: "info", title: "Opseg zadaje nastavnik u zadatku", state: "note" });
  });
  it("puts what the export solves apart from what the student ticks", () => {
    const items = itemsOf(full, stats());
    expect(items.filter((i) => i.group === "export").map((i) => i.key)).toEqual(expect.arrayContaining(["section:izjava", "typography", "style"]));
    expect(items.filter((i) => i.state === "tick").length).toBeGreaterThan(0);
  });
});

describe("counts and ticks", () => {
  it("counts a ticked manual item as in order and keeps ticks per profile", () => {
    const items = itemsOf(full, stats());
    const manual = items.find((i) => i.state === "tick")!;
    const before = countsOf(items, {});
    const ticks = toggleTick({}, full.id, manual.key);
    const after = countsOf(items, ticks[full.id]!);
    expect(after.ok).toBe(before.ok + 1);
    expect(after.manualOpen).toBe(before.manualOpen - 1);
    expect(toggleTick(ticks, full.id, manual.key)[full.id]![manual.key]).toBe(false);
    expect(ticks["other"]).toBeUndefined();
  });
  it("words the card line", () => {
    const items = itemsOf(full, stats({ words: 100 }));
    expect(cardLine(items, {})).toMatch(/^\d+ za riješiti · \d+ označavate sami/);
    expect(cardLine([], {})).toBe("sve provjereno u redu");
  });
});

describe("faculty list", () => {
  it("filters by name ignoring case and diacritics, grouped in area order", () => {
    expect(unitsByArea("PRAVNI", AREA_ORDER).flatMap((g) => g.units.map((u) => u.id))).toEqual(["pr"]);
    expect(unitsByArea("zzz", AREA_ORDER)).toEqual([]);
    expect(unitsByArea("", AREA_ORDER).map((g) => g.area)).toEqual(AREA_ORDER);
  });
  it("stars the style a faculty did not prescribe", () => {
    expect(tableRow(UNITS.find((u) => u.id === "pr")!).star).toBe(false);
    expect(tableRow(UNITS.find((u) => u.id === "af")!).star).toBe(true);
  });
});

describe("RulesHost", () => {
  it("draws nothing until the view menu opens it (ED-60: no button under the shell)", () => {
    const html = renderToStaticMarkup(createElement(RulesHost, {}));
    expect(html).not.toContain("Zahtjevi i fakultet");
    expect(html).not.toContain("Lekta");
    // The menu entry keeps the words of the old button.
    expect(rulesHr.open).toBe("Zahtjevi i fakultet");
  });
  it("keeps the interface text free of real people and of forbidden words", () => {
    const text = JSON.stringify(rulesHr).toLowerCase() + JSON.stringify(PROFILES).toLowerCase();
    for (const word of ["plagijat", "izvornost", "detektor", "varanje"]) expect(text, word).not.toContain(word);
    expect(JSON.stringify(rulesHr)).toContain("nedostupno");
  });
  it("leaves requests to the shared client", () => {
    const files = readdirSync(import.meta.dirname).filter((n) => /\.tsx?$/.test(n) && !/\.test\./.test(n));
    for (const file of files) {
      const code = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(code, file).not.toMatch(/\b(?:fetch|browserTransport|createApi|XMLHttpRequest|WebSocket|EventSource|sendBeacon|axios)\b|\/api\/v\d/);
    }
  });
});
