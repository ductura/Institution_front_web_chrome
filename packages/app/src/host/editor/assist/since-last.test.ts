import { describe, expect, it } from "vitest";

import { chaptersOf, type AssistBlock } from "./blocks";
import { loadSeen, parseSeen, saveSeen, seenKey, seenOf, whatsNew } from "./since-last";

// MEN-R12: invented text only.
const w = (n: number) => Array.from({ length: n }, () => "riječ").join(" ");
const blocks = (b: number): AssistBlock[] => [
  { id: "a", kind: "heading", level: 1, text: "Uvod", cites: 0 }, { id: "a1", kind: "text", level: 0, text: w(100), cites: 0 },
  { id: "b", kind: "heading", level: 1, text: "Okvir", cites: 0 }, { id: "b1", kind: "text", level: 0, text: w(b), cites: 0 },
];
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

describe("what is new since the last session", () => {
  it("gives nothing on a first visit or a broken store", () => {
    expect(whatsNew(null, chaptersOf(blocks(50)))).toEqual([]);
    expect(parseSeen("{nope")).toBeNull();
    expect(parseSeen("[1]")).toBeNull();
    expect(parseSeen(null)).toBeNull();
  });
  it("gives nothing when the work is as it was left", () => {
    const ch = chaptersOf(blocks(50));
    expect(whatsNew(seenOf(ch), ch)).toEqual([]);
  });
  it("names grown, shrunk and added chapters with word differences", () => {
    const before = seenOf(chaptersOf(blocks(50)));
    const grown = whatsNew(before, chaptersOf(blocks(80)));
    expect(grown.map((c) => [c.chapter.id, c.kind, c.delta])).toEqual([["b", "grown", 30]]);
    expect(whatsNew(before, chaptersOf(blocks(20))).map((c) => [c.kind, c.delta])).toEqual([["shrunk", 30]]);
    const more = [...blocks(50), { id: "c", kind: "heading", level: 1, text: "Zaključak", cites: 0 } as AssistBlock, { id: "c1", kind: "text", level: 0, text: w(40), cites: 0 } as AssistBlock];
    expect(whatsNew(before, chaptersOf(more)).map((c) => [c.chapter.id, c.kind, c.delta])).toEqual([["c", "added", 40]]);
  });
  it("keeps only valid numbers and round-trips through the device store", () => {
    expect(parseSeen('{"a":3,"b":-1,"c":"x","d":1.5}')).toEqual({ a: 3 });
    const s = mem();
    expect(saveSeen(s, "w1", chaptersOf(blocks(50)))).toBe(true);
    expect(s.getItem(seenKey("w1"))).not.toBeNull();
    expect(loadSeen(s, "w1")).toEqual({ a: 100, b: 50 });
    expect(loadSeen(s, "other")).toBeNull();
    expect(saveSeen(null, "w1", [])).toBe(false);
  });
});
