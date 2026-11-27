// ED-103: "Zadnje korišteni" in the citation popover, as the prototype's toolbar2.js cite. Invented sources only.
import { Schema } from "@tiptap/pm/model";
import { afterEach, describe, expect, it } from "vitest";

import { citedBefore, citedThisSession, forgetCited, recentSources, rememberCited } from "./citation-recent";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "inline*" },
    text: { group: "inline" },
    citation: { group: "inline", inline: true, atom: true, attrs: { sourceId: { default: null } } },
  },
});
const cite = (id: string) => schema.nodes.citation!.create({ sourceId: id });
const doc = schema.nodes.doc!.create(null, [
  schema.nodes.paragraph!.create(null, [schema.text("A "), cite("s1"), schema.text(" B "), cite("s2")]),
  schema.nodes.paragraph!.create(null, [cite("s3")]),
]);
const src = (id: string) => ({ id, label: `Izmišljeni ${id}` });
const five = ["s1", "s2", "s3", "s4", "s5"].map(src);

afterEach(forgetCited);

describe("Zadnje korišteni (ED-103)", () => {
  it("reads the citations before the cursor, the nearest first", () => {
    expect(citedBefore(doc, 8)).toEqual(["s2", "s1"]);
    expect(citedBefore(doc, 7)).toEqual(["s1"]);
    expect(citedBefore(doc, doc.content.size)).toEqual(["s3", "s2", "s1"]);
    expect(citedBefore(doc, 0)).toEqual([]);
  });

  it("puts this session's citations first, then those before the cursor, at most three, no repeats", () => {
    rememberCited("s4");
    rememberCited("s2");
    expect(citedThisSession()).toEqual(["s2", "s4"]);
    expect(recentSources(five, citedThisSession(), ["s2", "s1", "s3"]).map((s) => s.id)).toEqual(["s2", "s4", "s1"]);
  });

  it("is empty for three sources or fewer, and skips a source no longer in the list", () => {
    expect(recentSources(five.slice(0, 3), ["s1"], [])).toEqual([]);
    expect(recentSources(five, ["gone", "s5"], []).map((s) => s.id)).toEqual(["s5"]);
  });
});
