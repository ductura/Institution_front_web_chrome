import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { compositionAgrees, readOriginComposition, type OriginComposition } from "./contract";
import { DOCUMENT, FAKE_COMPOSITION, fakeOriginServer } from "./fake-port";
import { originText } from "./messages.hr";
import { rhythmCell, shareRows, unknownLine } from "./model";
import OriginMap from "./OriginMap";

describe("WEB-0911 origin composition", () => {
  it("reads the composition for the same document and request whoever asks", async () => {
    const { call, calls } = fakeOriginServer();
    const read = await readOriginComposition(call, DOCUMENT);
    expect(read).toEqual({ kind: "ready", composition: FAKE_COMPOSITION });
    expect(calls).toEqual([{ id: "work.origin-composition.get", params: { documentId: DOCUMENT } }]);
  });

  it("names every share by the closed list with its percent", () => {
    expect(shareRows(FAKE_COMPOSITION).map((r) => r.label)).toEqual([
      "Tipkano u Ducturi · 62 %",
      "Umetnuto iz pomoćnika · 10 %",
      "Podudara se s odgovorom pomoćnika · 4 %",
      "Uvezeno iz datoteke · 12 %",
      "Zalijepljeno, podrijetlo poznato · 9 %",
      "Zalijepljeno, podrijetlo nepoznato · 3 %",
    ]);
    expect(unknownLine(FAKE_COMPOSITION)).toBe("3 % nepoznato podrijetlo");
  });

  it("refuses a kind outside the closed list and any key of pressed keys or speed", async () => {
    const bad = (patch: object) => readOriginComposition(fakeOriginServer({ composition: { ...FAKE_COMPOSITION, ...patch } }).call, DOCUMENT);
    expect((await bad({ shares: [{ kind: "suspicious", codePoints: 1000, percent: 100 }] })).kind).toBe("unavailable");
    expect((await bad({ wordsPerMinute: 42 })).kind).toBe("unavailable");
    expect((await bad({ segments: [{ id: "s", text: "x", kind: "typed", at: "2026-11-18T09:00:00.000Z", keys: ["a"] }] })).kind).toBe("unavailable");
    expect((await bad({ segments: [{ id: "s", text: "x", kind: "typed", at: "2026-11-18T09:00:00.000Z", gapsMs: Array(131).fill(100) }] })).kind).toBe("unavailable");
  });

  it("refuses an answer that does not agree with itself, and rhythm when it is switched off", () => {
    expect(compositionAgrees(FAKE_COMPOSITION)).toBe(true);
    expect(compositionAgrees({ ...FAKE_COMPOSITION, totalCodePoints: 999 })).toBe(false);
    expect(compositionAgrees({ ...FAKE_COMPOSITION, shares: [...FAKE_COMPOSITION.shares, FAKE_COMPOSITION.shares[0]!] })).toBe(false);
    expect(compositionAgrees({ ...FAKE_COMPOSITION, rhythmRecorded: false })).toBe(false);
  });

  it("maps statuses and an empty text", async () => {
    expect((await readOriginComposition(fakeOriginServer({ status: 401 }).call, DOCUMENT)).kind).toBe("signedOut");
    expect((await readOriginComposition(fakeOriginServer({ status: 404 }).call, DOCUMENT)).kind).toBe("notFound");
    expect((await readOriginComposition(fakeOriginServer({ status: 500 }).call, DOCUMENT)).kind).toBe("unavailable");
    expect((await readOriginComposition(fakeOriginServer({ throws: true }).call, DOCUMENT)).kind).toBe("unavailable");
    const empty: OriginComposition = { totalCodePoints: 0, rhythmRecorded: true, shares: [], segments: [] };
    expect((await readOriginComposition(fakeOriginServer({ composition: empty }).call, DOCUMENT)).kind).toBe("empty");
  });

  it("shows the rhythm only as gaps of the segment and only while it is recorded", () => {
    expect(rhythmCell(FAKE_COMPOSITION, FAKE_COMPOSITION.segments[0]!)).toBe("180 220 140");
    expect(rhythmCell(FAKE_COMPOSITION, FAKE_COMPOSITION.segments[1]!)).toBe(originText.rhythmNone);
    expect(rhythmCell({ ...FAKE_COMPOSITION, rhythmRecorded: false, segments: [] }, FAKE_COMPOSITION.segments[0]!)).toBeNull();
  });

  it("holds no forbidden term (PRODUCT §5)", () => {
    for (const value of Object.values(originText)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });

  it("holds no network primitive and uses Button of @ductura/ui", () => {
    const forbidden = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b/;
    const dir = import.meta.dirname;
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const f of files) expect({ f, hit: forbidden.test(readFileSync(join(dir, f), "utf8")) }).toEqual({ f, hit: false });
    expect(readFileSync(join(dir, "OriginMap.tsx"), "utf8")).toMatch(/import \{[^}]*\bButton\b[^}]*\} from "@ductura\/ui"/);
  });

  it("renders the loading state with both notices in the screen copy", () => {
    const html = renderToStaticMarkup(createElement(OriginMap, { call: fakeOriginServer().call, documentId: DOCUMENT }));
    expect(html).toContain(originText.title);
    expect(html).toContain(originText.limits);
    expect(html).toContain(originText.loading);
  });
});
