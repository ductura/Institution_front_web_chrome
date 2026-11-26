// WEB-V13-NASTAVNIK-PREGLED: the comparison and the reading of a revision. Invented slides only.
import { describe, expect, it } from "vitest";

import { slidesRevisionZeroDocument, slidesSnapshotText, type Slide, type SlidesDocument } from "../../../../../editor-core/src/slides/index.ts";
import { compareSlides, parseRevisionDocument, slideTitle } from "./model.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const slide = (n: number, text: string, extra: Partial<Slide> = {}): Slide => ({
  id: id(n), layout: "titleContent", blocks: [{ type: "heading", id: id(100 + n), slot: "title", text }], ...extra,
});
const doc = (...slides: Slide[]): SlidesDocument => ({ documentKind: "slides", schemaVersion: 1, slides });

describe("compareSlides", () => {
  it("reports nothing for equal documents", () => {
    expect(compareSlides(doc(slide(1, "A")), doc(slide(1, "A"))).changes).toEqual([]);
  });
  it("finds added, removed and changed slides, with what changed", () => {
    const older = doc(slide(1, "A"), slide(2, "B"), slide(3, "C"));
    const newer = doc(slide(1, "A2", { notes: "bilješka" }), slide(3, "C"), slide(4, "D"));
    const r = compareSlides(older, newer);
    expect([r.added, r.removed, r.changed]).toEqual([1, 1, 1]);
    const changed = r.changes.find((c) => c.kind === "changed");
    expect(changed).toMatchObject({ kind: "changed", parts: ["blocks", "notes"] });
  });
  it("names a pure reorder as a change of position, not as nothing", () => {
    const r = compareSlides(doc(slide(1, "A"), slide(2, "B")), doc(slide(2, "B"), slide(1, "A")));
    expect(r.changes.length).toBeGreaterThan(0);
    expect(r.changes.every((c) => c.kind === "changed" && c.parts.includes("position"))).toBe(true);
  });
  it("is not moved by a removed slide in front of the others", () => {
    expect(compareSlides(doc(slide(1, "A"), slide(2, "B")), doc(slide(2, "B"))).changes.map((c) => c.kind)).toEqual(["removed"]);
  });
  it("sees a changed layout", () => {
    const r = compareSlides(doc(slide(1, "A")), doc(slide(1, "A", { layout: "title" })));
    expect(r.changes[0]).toMatchObject({ kind: "changed", parts: ["layout"] });
  });
});

describe("parseRevisionDocument", () => {
  it("accepts the exact canonical text of a slides document", async () => {
    const text = slidesSnapshotText(slidesRevisionZeroDocument());
    expect(await parseRevisionDocument(3, text)).toMatchObject({ kind: "ready", revision: 3 });
  });
  it("refuses a text that is not canonical, not slides or not valid", async () => {
    expect(await parseRevisionDocument(1, `${slidesSnapshotText(slidesRevisionZeroDocument())} `)).toEqual({ kind: "invalid" });
    expect(await parseRevisionDocument(1, '{"schemaVersion":4,"nodes":[]}')).toEqual({ kind: "invalid" });
    expect(await parseRevisionDocument(1, "nije json")).toEqual({ kind: "invalid" });
  });
});

describe("slideTitle", () => {
  it("is the title block, else the first text, else null", () => {
    expect(slideTitle(slide(1, "Naslov"))).toBe("Naslov");
    expect(slideTitle({ id: id(9), layout: "titleContent", blocks: [] })).toBeNull();
  });
});
