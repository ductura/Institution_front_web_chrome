import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";

import { allPlaces, gutterDots, hasNext, holeRemoval, nextPlace, placesAt, showGutter } from "./marks-model";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
    citation: { inline: true, atom: true, group: "inline", attrs: { sourceId: { default: "s" }, rq: { default: null } } },
  },
});
const p = (...c: ReturnType<typeof schema.text | typeof schema.node>[]) => schema.node("paragraph", null, c);
const doc = schema.node("doc", null, [
  p(schema.text("Uvod [?] i (Izmišljeni, 2020) tekst.")),
  p(schema.text("Drugi "), schema.node("citation", { sourceId: "s", rq: "r1" }), schema.text(" odlomak.")),
]);

describe("marks model (WEB-2129)", () => {
  const places = allPlaces(doc, [{ from: 2, to: 6 }]);
  it("finds hole, text citation, requested proof and comment with their levels", () => {
    expect(places.map((x) => [x.kind, x.level])).toEqual([["cmt", 2], ["hole", 1], ["plain", 1], ["need", 2]]);
    expect(places.find((x) => x.kind === "cmt")!.name).toBe("Komentar: vod");
  });
  // ED-60: the counter bar is gone; the jump lives in the popover, offered only when its kind has another mark.
  it("offers the popover's next place only when the kind has another mark", () => {
    expect(hasNext(places, "hole")).toBe(false);
    const two = allPlaces(schema.node("doc", null, [p(schema.text("A [?] b [?] c."))]), []);
    expect(hasNext(two, "hole")).toBe(true);
    const first = two.find((x) => x.kind === "hole")!;
    expect(nextPlace(two, "hole", first.to)).not.toBe(first);
    expect(hasNext(two, "cmt")).toBe(false);
  });
  it("offers 'Na ovom mjestu' only where marks overlap, level 1 first", () => {
    const hole = places.find((x) => x.kind === "hole")!;
    const overlap = placesAt(allPlaces(doc, [{ from: hole.from, to: hole.to }]), hole.from + 1);
    expect(overlap.map((x) => x.kind)).toEqual(["hole", "cmt"]);
    expect(placesAt(places, 1)).toEqual([]);
  });
  it("jumps to the next mark of a kind and wraps", () => {
    const hole = places.find((x) => x.kind === "hole")!;
    expect(nextPlace(places, "hole", 0)).toBe(hole);
    expect(nextPlace(places, "hole", hole.to)).toBe(hole);
    expect(nextPlace(places, "cite", 0)).toBeNull();
  });
  it("stacks gutter dots at one height by 11 px and skips marks without a place", () => {
    const dots = gutterDots(allPlaces(doc, [{ from: 9, to: 12 }]), (pos) => (pos === 2 ? null : 40));
    expect(dots.map((d) => [d.kind, d.offset])).toEqual([["hole", 0], ["cmt", 11]]);
    expect(dots.every((d) => d.y === 40)).toBe(true);
  });
  // ED-45: "Provjereno, ukloni" leaves the sentence as it would read without the mark.
  it("takes the hole out with one space, never leaving two or eating punctuation", () => {
    const left = (text: string) => {
      const d = schema.node("doc", null, [p(schema.text(text))]);
      const range = holeRemoval(d, allPlaces(d, []).find((x) => x.kind === "hole")!);
      return d.textBetween(0, range.from, "", "") + d.textBetween(range.to, d.content.size, "", "");
    };
    expect(left("Uvod [?] i tekst.")).toBe("Uvod i tekst.");
    expect(left("[?] Početak.")).toBe("Početak.");
    expect(left("Kraj [?].")).toBe("Kraj .");
    expect(left("Riječ[?] dalje.")).toBe("Riječ dalje.");
    expect(left("Kraj [?]")).toBe("Kraj ");
  });
  it("draws the gutter only wider than 1050 px", () => {
    expect(showGutter(1050)).toBe(false);
    expect(showGutter(1051)).toBe(true);
  });
});
