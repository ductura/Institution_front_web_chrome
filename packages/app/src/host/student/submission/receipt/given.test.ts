// NF-3 PR-11 (E-11d): "Što je predano" says what the server gave, line by line. Invented data only.
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { givenLines, type GivenInput } from "./given";
import { receiptText } from "./messages.hr";

const NOTE = { id: "n1", text: "Izmišljena napomena.", createdAt: "2026-11-04T10:00:00.000000Z" };
const FULL: GivenInput = {
  revision: 4, words: 5120,
  declaration: { kind: "confirmed", detail: "bound", confirmedAt: "2026-11-04T10:00:00.000000Z" },
  notes: { kind: "ready", notes: [NOTE, { ...NOTE, id: "n2" }] },
};

describe("givenLines", () => {
  it("puno: version, words, the declaration with its time and the notes, as the prototype lists them", () => {
    expect(givenLines(FULL)).toEqual([
      "Verzija teksta: V4", "Riječi: 5.120", "Izjava: potvrđena 4. 11. 2026. u 11:00", "Napomene uz rad: 2",
    ]);
  });

  it("a declaration the assignment did not ask for is said so", () => {
    expect(givenLines({ ...FULL, declaration: { kind: "not_required" } })[2]).toBe("Izjava: nije bila potrebna");
  });

  it("a confirmed declaration without its time is still confirmed, never more", () => {
    expect(givenLines({ ...FULL, declaration: { kind: "confirmed" } })[2]).toBe("Izjava: potvrđena");
  });

  it("while reading and after a failed read each line says so; nothing is guessed", () => {
    expect(givenLines({ ...FULL, words: "loading", declaration: { kind: "loading" }, notes: { kind: "loading" } }).slice(1)).toEqual([
      "Riječi: učitavam…", "Izjava: provjeravam…", "Napomene uz rad: učitavam…",
    ]);
    expect(givenLines({ ...FULL, words: null, declaration: { kind: "unavailable" }, notes: { kind: "unavailable" } }).slice(1)).toEqual([
      receiptText.givenWordsUnknown, receiptText.givenDeclarationUnknown, receiptText.givenNotesUnknown,
    ]);
    expect(givenLines({ ...FULL, declaration: { kind: "missing", detail: "stale" } })[2]).toBe(receiptText.givenDeclarationUnknown);
  });

  it("no percentage and no forbidden term in any line or new message", () => {
    const added = Object.entries(receiptText).filter(([key]) => /^(given|save|summaryOpened|downloadFailed)/.test(key)).map(([, text]) => text);
    expect(added.length).toBeGreaterThanOrEqual(17);
    for (const text of [...givenLines(FULL), ...added]) {
      expect(text, text).not.toContain("%");
      expect({ text, hits: findForbiddenTerms(text) }).toEqual({ text, hits: [] });
    }
  });
});
