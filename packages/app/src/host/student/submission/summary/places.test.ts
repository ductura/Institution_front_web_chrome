import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { checksText as c } from "./messages.hr";
import { PLACE_MARK, pastesOf, placesOf } from "./places";

// WEB-NUZ-PREDAJA-2 (NF-3 PR-3): invented text only.
const p = (text: string) => ({ type: "paragraph" as const, children: [{ text, marks: [] }] });
const h = (text: string) => ({ type: "heading" as const, level: 1, children: [{ text, marks: [] }] });

describe("placesOf", () => {
  it("lists every place left for a source under its heading and paragraph", () => {
    const nodes = [
      p("Uvodna rečenica bez oznake."),
      p("Gradski vrtovi [izvor] mijenjaju susjedstvo."),
      h("2. Teorijski okvir"),
      p("Prvi odlomak."),
      p("Drugi odlomak s dvije oznake [?] i [provjeri godinu]."),
      { type: "quote" as const, children: [{ text: "Citat [stranica]", marks: [] }] },
    ];
    expect(placesOf(nodes)).toEqual([
      { where: c.placeAlone.replace("{n}", "2"), mark: "[izvor]" },
      { where: "2. Teorijski okvir, odlomak 2", mark: "[?]" },
      { where: "2. Teorijski okvir, odlomak 2", mark: "[provjeri godinu]" },
      { where: "2. Teorijski okvir, odlomak 3", mark: "[stranica]" },
    ]);
  });

  it("finds nothing in ordinary brackets and in a text with no marks", () => {
    expect(placesOf([p("Godina [2026] i (izvor) nisu oznake.")])).toEqual([]);
    expect(placesOf([])).toEqual([]);
  });

  it("uses the same marks as the editor's review, so the step and the rehearsal agree", () => {
    const editor = readFileSync(join(import.meta.dirname, "../../../../../../../src/components/editor/citations/review-places.ts"), "utf8");
    const source = editor.match(/matchAll\(\/(.+)\/giu\)/)?.[1];
    expect(source).toBe(PLACE_MARK.source);
  });
});

describe("pastesOf", () => {
  it("keeps the listed pastes, the smaller count and the threshold of the summary", () => {
    const summary = {
      summaryFormat: "process-summary-v1", recordState: "continuous",
      sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 0, items: [] },
      gaps: { evidenceKind: "observed", items: [] },
      pastes: { evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 3, listed: [{ at: { from: "2026-11-18T09:00:00.000Z", to: "2026-11-18T09:05:00.000Z" }, characters: 420, origin: "not_observed" }] },
    } as never;
    expect(pastesOf(summary)).toEqual({ listed: [{ at: { from: "2026-11-18T09:00:00.000Z", to: "2026-11-18T09:05:00.000Z" }, characters: 420, origin: "not_observed" }], smaller: 3, threshold: 200 });
  });
});
