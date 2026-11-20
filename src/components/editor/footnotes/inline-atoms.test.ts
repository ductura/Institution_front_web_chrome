import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { expect, it } from "vitest";

import { insertAcademicAtom, supportsAcademicAtoms } from "./inline-atoms";

const blocks = {
  doc: { content: "block+" },
  heading: { group: "block", content: "text*" },
  paragraph: { group: "block", content: "inline*" },
  text: { group: "inline" },
};
const schema = new Schema({ nodes: {
  ...blocks,
  footnote: { inline: true, atom: true, group: "inline", attrs: { text: {} } },
  crossReference: { inline: true, atom: true, group: "inline", attrs: { targetId: {} } },
} });
const stateAt = (kind: "paragraph" | "heading") => {
  const doc = schema.node("doc", null, schema.node(kind, null, schema.text("Izmišljeni tekst")));
  return EditorState.create({ doc, selection: TextSelection.create(doc, 3) });
};

it("requires both server confirmation for this work and the atom types", () => {
  const legacy = new Schema({ nodes: blocks });
  expect(supportsAcademicAtoms(legacy, 3)).toBe(false);
  for (const version of [undefined, 1, 2, 4]) {
    expect(insertAcademicAtom(stateAt("paragraph"), version, "footnote", { text: "Izmišljena fusnota" })).toBeNull();
  }
});

it("inserts the contracted attributes in body text and protects headings", () => {
  const attrs = { targetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
  const state = stateAt("paragraph");
  expect(insertAcademicAtom(state, 3, "crossReference", attrs)?.doc.nodeAt(3)?.toJSON()).toEqual({
    type: "crossReference", attrs,
  });
  expect(insertAcademicAtom(stateAt("heading"), 3, "crossReference", attrs)).toBeNull();
});
