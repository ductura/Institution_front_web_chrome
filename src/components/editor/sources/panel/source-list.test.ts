// @vitest-environment node
import { describe, expect, it } from "vitest";

import { filterSources, splitByCitation, summarize, type ListedSource } from "./source-list";

// Invented authors and titles only.
const items: ListedSource[] = [
  { entry: "Autor A. (2019) Naslov knjige. Zagreb: Nakladnik A", cited: true, tag: "mandatory" },
  { entry: "Autor B. (2021) Čitanje u školi. Časopis B, 4(2), 11–20", cited: false, tag: "recommended" },
  { entry: "Autor C. (2017) Jezični razvoj. Zagreb: Nakladnik C", cited: false },
];

describe("source list", () => {
  it("keeps all sources for an empty query", () => {
    expect(filterSources(items, "  ")).toHaveLength(3);
  });

  it("matches every word, case and spacing aside", () => {
    expect(filterSources(items, "ČITANJE  ško").map((s) => s.entry)).toEqual([items[1]!.entry]);
    expect(filterSources(items, "zagreb 2017")).toEqual([items[2]]);
    expect(filterSources(items, "nepostoji")).toEqual([]);
  });

  it("splits by citation without losing a source", () => {
    const { cited, uncited } = splitByCitation(items);
    expect(cited).toHaveLength(1);
    expect(uncited).toHaveLength(2);
  });

  it("summarizes the literature", () => {
    expect(summarize(items)).toEqual({ total: 3, cited: 1, uncited: 2, mandatory: 1, recommended: 1 });
    expect(summarize([])).toEqual({ total: 0, cited: 0, uncited: 0, mandatory: 0, recommended: 0 });
  });
});
