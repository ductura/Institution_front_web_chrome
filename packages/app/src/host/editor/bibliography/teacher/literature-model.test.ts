import { describe, expect, it } from "vitest";

import { hrDate, hrDay, literatureOf, overviewRows, overviewSummary, readSeen, writeSeen } from "./literature-model";

import { A, B, C, DOC } from "./literature-fixture";

describe("literatureOf", () => {
  const lit = literatureOf(DOC);
  it("reads the sources with their labels and kinds", () => {
    expect(lit.sources.map((s) => [s.label, s.kind])).toEqual([
      ["Izmišljena (2015)", "knjiga"], ["Autor i Drugi (2019)", "članak"], ["ZZP (2021)", "mrežni izvor"],
    ]);
  });
  it("counts citations per source", () => {
    expect([lit.cites.get(A), lit.cites.get(B), lit.cites.get(C)]).toEqual([2, 1, undefined]);
  });
  it("lists the citations whose proof was requested, with the page", () => {
    expect(lit.requests).toEqual([{ sourceId: A, label: "Izmišljena (2015)", page: "14", rq: "00000000-0000-4000-8000-0000000000f1" }]);
  });
  it("gives empty lists for a document without sources (v1) and for anything else", () => {
    expect(literatureOf({ schemaVersion: 1, nodes: [] })).toEqual({ sources: [], cites: new Map(), requests: [] });
    expect(literatureOf(null).sources).toEqual([]);
    expect(literatureOf({ sources: [{ id: 1 }, "x"], nodes: "x" }).sources).toEqual([]);
  });
});

describe("overview", () => {
  const lit = literatureOf(DOC);
  it("sorts alphabetically and marks nothing new before the first review", () => {
    const rows = overviewRows(lit, null);
    expect(rows.map((r) => [r.label, r.cites, r.fresh])).toEqual([
      ["Autor i Drugi (2019)", 1, false], ["Izmišljena (2015)", 2, false], ["ZZP (2021)", 0, false],
    ]);
    expect(overviewSummary(rows, null)).toBe("3 izvora · citirano 2 · mentor još nije označio pregled");
  });
  it("marks the sources added after the review as new", () => {
    const seen = { when: "20. 11. 2026.", ids: [A, B] };
    const rows = overviewRows(lit, seen);
    expect(rows.filter((r) => r.fresh).map((r) => r.id)).toEqual([C]);
    expect(overviewSummary(rows, seen)).toBe("3 izvora · citirano 2 · novo od pregleda 20. 11. 2026.: 1");
  });
  it("uses the singular for one source", () => {
    expect(overviewSummary(overviewRows(literatureOf({ ...DOC, sources: DOC.sources.slice(0, 1) }), null), null))
      .toBe("1 izvor · citirano 1 · mentor još nije označio pregled");
  });
});

describe("dates and the review mark", () => {
  it("writes dates as the prototype does", () => {
    expect(hrDate(new Date(2026, 10, 22))).toBe("22. 11. 2026.");
    expect(hrDay("not a date")).toBe("not a date");
  });
  it("keeps the mark per work and reads malformed values as none", () => {
    const map = new Map<string, string>();
    const store = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    expect(readSeen("w1", store)).toBeNull();
    expect(writeSeen("w1", { when: "22. 11. 2026.", ids: [A] }, store)).toBe(true);
    expect(readSeen("w1", store)).toEqual({ when: "22. 11. 2026.", ids: [A] });
    expect(readSeen("w2", store)).toBeNull();
    map.set("ductura.teacher.lit-seen:w3", "{bad");
    expect(readSeen("w3", store)).toBeNull();
    expect(writeSeen("w1", { when: "x", ids: [] }, null)).toBe(false);
  });
});
