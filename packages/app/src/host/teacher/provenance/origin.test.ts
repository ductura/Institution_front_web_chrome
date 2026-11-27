import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import type { OriginComposition } from "./origin";
import { originText } from "./origin-messages.hr";
import { rhythmCell, shareRows, unknownLine } from "./origin-model";

// Moved from the removed teacher/origin-map (PIL-P1-PODUDARANJE-KARTA): the captions and rows that the student's
// "Podrijetlo teksta" and N-10 read from here. Invented work; no real person or text.
const COMPOSITION: OriginComposition = {
  totalCodePoints: 1000,
  rhythmRecorded: true,
  shares: [
    { kind: "typed", codePoints: 620, percent: 62 },
    { kind: "assistant_inserted", codePoints: 100, percent: 10 },
    { kind: "assistant_match", codePoints: 40, percent: 4 },
    { kind: "imported_file", codePoints: 120, percent: 12 },
    { kind: "pasted_known", codePoints: 90, percent: 9 },
    { kind: "pasted_unknown", codePoints: 30, percent: 3 },
  ],
  segments: [
    { id: "s1", text: "Izmišljeni uvodni odlomak.", kind: "typed", at: "2026-11-18T09:00:00.000Z", gapsMs: [180, 220, 140] },
    { id: "s2", text: "Izmišljeni zalijepljeni odlomak.", kind: "pasted_unknown", at: "2026-11-18T09:20:00.000Z" },
  ],
};

describe("WEB-0911 origin composition", () => {
  it("names every share by the closed list with its percent", () => {
    expect(shareRows(COMPOSITION).map((r) => r.label)).toEqual([
      "Tipkano u Ducturi, 62 %",
      "Umetnuto iz pomoćnika, 10 %",
      "Podudara se s odgovorom pomoćnika, 4 %",
      "Uvezeno iz datoteke, 12 %",
      "Zalijepljeno, podrijetlo poznato, 9 %",
      "Zalijepljeno, podrijetlo nepoznato, 3 %",
    ]);
    expect(unknownLine(COMPOSITION)).toBe("3 % nepoznato podrijetlo");
  });

  it("leaves out a kind without text and names a share below one percent", () => {
    const shares = COMPOSITION.shares.map((s) => (s.kind === "assistant_match" ? { ...s, codePoints: 0, percent: 0 } : s.kind === "pasted_unknown" ? { ...s, percent: 0 } : s));
    const rows = shareRows({ ...COMPOSITION, shares });
    expect(rows.some((r) => r.kind === "assistant_match")).toBe(false);
    expect(rows.at(-1)?.label).toBe("Zalijepljeno, podrijetlo nepoznato, manje od 1 %");
  });

  it("shows the rhythm only as gaps of the segment and only while it is recorded", () => {
    expect(rhythmCell(COMPOSITION, COMPOSITION.segments[0]!)).toBe("180 220 140");
    expect(rhythmCell(COMPOSITION, COMPOSITION.segments[1]!)).toBe(originText.rhythmNone);
    expect(rhythmCell({ ...COMPOSITION, rhythmRecorded: false, segments: [] }, COMPOSITION.segments[0]!)).toBeNull();
  });

  it("holds no forbidden term (PRODUCT §5)", () => {
    for (const value of Object.values(originText)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
