import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";

import { atomAvailability, prepareFootnoteText } from "./footnote-model";

const v3 = new Schema({ nodes: {
  doc: { content: "block+" }, text: { group: "inline" }, paragraph: { group: "block", content: "inline*" },
  footnote: { group: "inline", inline: true, atom: true, attrs: { text: {} } },
  crossReference: { group: "inline", inline: true, atom: true, attrs: { targetId: {} } },
} });
const plain = new Schema({ nodes: { doc: { content: "block+" }, text: { group: "inline" }, paragraph: { group: "block", content: "inline*" } } });

describe("prepareFootnoteText", () => {
  it("joins lines and trims", () => expect(prepareFootnoteText("  a\r\nb\tc  ")).toBe("a b c"));
  it("empty means remove", () => expect(prepareFootnoteText("  \n ")).toBe(""));
  it("rejects over 2000 code points", () => {
    expect(prepareFootnoteText("a".repeat(2000))).not.toBeNull();
    expect(prepareFootnoteText("a".repeat(2001))).toBeNull();
  });
});

describe("atomAvailability", () => {
  it("enabled for schema v3 and an editable work", () => expect(atomAvailability(v3, 3, true).enabled).toBe(true));
  it("disabled without the confirmed schema version", () => {
    expect(atomAvailability(v3, undefined, true).enabled).toBe(false);
    expect(atomAvailability(plain, 3, true).enabled).toBe(false);
  });
  it("disabled in a read-only work", () => expect(atomAvailability(v3, 3, false).enabled).toBe(false));
});
