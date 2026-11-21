import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  deriveChapters,
  DOCUMENT_SCHEMA_VERSION,
  textNode,
  validateVersionedDocument,
  type CanonicalDocument,
  type DocumentNode,
  type HeadingLevel,
  type NodeId,
} from "../document/document";

import vectors from "./chapter-numbers.vectors.json";
import { chapterNumberVector, compareChapterNumbers, moveChapter, planChapterMove, tableOfContents, tocText } from "./index";

/**
 * WEB-1602 (M5.3, DAN-395): the table of contents and the heading numbers are
 * read from the one projection by block id; a chapter move keeps every id; the
 * export carries the same numbers. Invented text only.
 */

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as NodeId;
const h = (n: number, level: HeadingLevel, text = `Naslov ${n}`): DocumentNode => ({
  type: "heading",
  id: id(n),
  level,
  children: text === "" ? [] : [textNode(text)],
});
const p = (n: number): DocumentNode => ({ type: "paragraph", id: id(n), children: [textNode(`Odlomak ${n}`)] });
const doc = (...nodes: DocumentNode[]): CanonicalDocument => ({ schemaVersion: DOCUMENT_SCHEMA_VERSION, nodes });
const ids = (d: CanonicalDocument) => d.nodes.map((n) => n.id);

describe("tableOfContents", () => {
  it("is the projection of deriveChapters: same ids, numbers, titles and parents", () => {
    const d = doc(p(1), h(2, 1, " Uvod "), p(3), h(4, 2, "Cilj"), h(5, 3, ""), h(6, 1, "Rasprava"));
    const chapters = deriveChapters(d).chapters;
    expect(tableOfContents(d)).toEqual(
      chapters.map((c) => ({ blockId: c.blockId, level: c.level, number: c.number, title: c.title, parentId: c.parentId })),
    );
    expect(tableOfContents(d).map((e) => [e.number, e.title])).toEqual([["1", "Uvod"], ["1.1", "Cilj"], ["1.1.1", ""], ["2", "Rasprava"]]);
  });

  it("takes a profile like the projection does", () => {
    const roman = { label: (path: readonly number[]) => path.map((n) => "I".repeat(n)).join("-") };
    expect(tableOfContents(doc(h(1, 1), h(2, 1), h(3, 2)), roman).map((e) => e.number)).toEqual(["I", "II", "II-I"]);
  });

  it("an empty work has an empty table of contents", () => {
    expect(tableOfContents(doc(p(1)))).toEqual([]);
  });

  it("gives the copy text indented by level, with a name for an empty heading", () => {
    const entries = tableOfContents(doc(h(1, 1, "Uvod"), h(2, 2, "Cilj"), h(3, 3, ""), h(4, 1, "Kraj")));
    expect(tocText(entries, "Bez naslova")).toBe("1. Uvod\n  1.1. Cilj\n    1.1.1. Bez naslova\n2. Kraj");
  });
});

describe("moveChapter: a move never changes an id", () => {
  const work = doc(p(1), h(2, 1, "Uvod"), p(3), h(4, 2, "Cilj"), p(5), h(6, 1, "Okvir"), p(7), h(8, 1, "Kraj"));

  it("moves the heading with its blocks and deeper chapters past the sibling", () => {
    const moved = moveChapter(work, id(6), "up")!;
    expect(ids(moved)).toEqual([id(1), id(6), id(7), id(2), id(3), id(4), id(5), id(8)]);
    expect(chapterNumberVector(moved)).toEqual([[id(6), "1"], [id(2), "2"], [id(4), "2.1"], [id(8), "3"]]);
  });

  it("keeps the same node objects: nothing is copied or re-minted", () => {
    const moved = moveChapter(work, id(2), "down")!;
    expect(ids(moved)).toEqual([id(1), id(6), id(7), id(2), id(3), id(4), id(5), id(8)]);
    for (const node of moved.nodes) expect(work.nodes).toContain(node);
    expect(work.nodes.map((n) => n.id)).toEqual([id(1), id(2), id(3), id(4), id(5), id(6), id(7), id(8)]);
  });

  it("does not move past the parent, the first or the last sibling, or the preamble", () => {
    expect(moveChapter(work, id(2), "up")).toBeNull();
    expect(moveChapter(work, id(8), "down")).toBeNull();
    expect(moveChapter(work, id(4), "up")).toBeNull();
    expect(moveChapter(work, id(4), "down")).toBeNull();
    expect(moveChapter(work, id(3), "up")).toBeNull();
    expect(moveChapter(work, id(99), "up")).toBeNull();
  });

  it("does not swap with a neighbour of another level (a skipped level)", () => {
    const gap = doc(h(1, 1), h(2, 3), h(3, 2));
    expect(moveChapter(gap, id(2), "down")).toBeNull();
    expect(moveChapter(gap, id(3), "up")).toBeNull();
  });

  it("any move keeps the multiset of ids, the preamble, and down after up is the start again", () => {
    const block = fc.oneof(fc.constant(0), fc.constant(1), fc.constant(2), fc.constant(3));
    fc.assert(
      fc.property(fc.array(block, { minLength: 1, maxLength: 14 }), fc.nat(), fc.boolean(), (kinds, pick, up) => {
        const d = doc(...kinds.map((k, i) => (k === 0 ? p(i + 1) : h(i + 1, k as HeadingLevel))));
        const chapters = deriveChapters(d).chapters;
        if (chapters.length === 0) return;
        const target = chapters[pick % chapters.length]!.blockId;
        const moved = moveChapter(d, target, up ? "up" : "down");
        if (!moved) return;
        expect([...ids(moved)].sort()).toEqual([...ids(d)].sort());
        expect(deriveChapters(moved).preambleBlockIds).toEqual(deriveChapters(d).preambleBlockIds);
        expect(validateVersionedDocument(moved).ok).toBe(true);
        expect(moveChapter(moved, target, up ? "down" : "up")).toEqual(d);
      }),
      { numRuns: 300 },
    );
  });

  it("the plan reports where the moved heading lands", () => {
    // Blocks: 0 h1, 1 p, 2 h1, 3 p, 4 p.
    const plan = planChapterMove([{ block: 0, level: 1 }, { block: 2, level: 1 }], 5, 0, "down")!;
    expect(plan).toEqual({ start: 0, end: 5, order: [2, 3, 4, 0, 1], moved: 3 });
  });
});

describe("the export carries the same numbers (SRV-1512 vectors)", () => {
  it.each(vectors.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const checked = validateVersionedDocument(c.document);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const projected = chapterNumberVector(checked.doc);
    expect(projected).toEqual(c.numbers);
    expect(compareChapterNumbers(projected, c.numbers as unknown as [string, string][])).toEqual({ equal: true, mismatches: [] });
  });

  it("names every difference: a changed number, a missing or extra heading, another order", () => {
    const expected = [[id(1), "1"], [id(2), "1.1"], [id(3), "2"]] as const;
    expect(compareChapterNumbers(expected, [[id(1), "1"], [id(2), "1.2"], [id(3), "2"]]).mismatches).toEqual([
      { kind: "number", blockId: id(2), expected: "1.1", actual: "1.2" },
    ]);
    expect(compareChapterNumbers(expected, [[id(1), "1"], [id(3), "2"], [id(9), "3"]]).mismatches).toEqual([
      { kind: "missing", blockId: id(2), expected: "1.1" },
      { kind: "extra", blockId: id(9), actual: "3" },
    ]);
    expect(compareChapterNumbers([[id(1), "1"], [id(2), "1"]], [[id(2), "1"], [id(1), "1"]]).mismatches).toEqual([
      { kind: "order", index: 0, expected: id(1), actual: id(2) },
      { kind: "order", index: 1, expected: id(2), actual: id(1) },
    ]);
  });
});
