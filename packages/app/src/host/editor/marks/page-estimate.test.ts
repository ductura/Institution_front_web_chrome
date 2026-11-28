import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";

import { marksHr } from "./messages.hr";
import { pageStarts, WORDS_PER_PAGE } from "./page-estimate";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*", group: "block" },
    heading: { content: "text*", group: "block" },
    text: {},
  },
});
const words = (n: number) => Array.from({ length: n }, (_, i) => `riječ${i}`).join(" ");
const p = (n: number) => schema.node("paragraph", null, n ? [schema.text(words(n))] : []);

describe("ED-126: Procjena stranica u rubu", () => {
  it("marks where page 2 and 3 begin, 350 words a page, as in the prototype", () => {
    expect(WORDS_PER_PAGE).toBe(350);
    const doc = schema.node("doc", null, [p(200), p(200), p(100), p(300)]);
    const starts = pageStarts(doc);
    expect(starts.map((s) => s.page)).toEqual([2, 3]);
    // Page 2 is put at the second paragraph (200 + 200 passes 350), page 3 at the fourth (800 passes 700).
    const second = doc.child(0).nodeSize;
    const fourth = second + doc.child(1).nodeSize + doc.child(2).nodeSize;
    expect(starts[0]!.pos).toBe(second + 1);
    expect(starts[1]!.pos).toBe(fourth + 1);
  });

  it("skips a page number when one paragraph spans more than a page", () => {
    const doc = schema.node("doc", null, [p(100), p(800), p(10)]);
    expect(pageStarts(doc).map((s) => s.page)).toEqual([3]);
  });

  it("puts no mark in a short text or an empty one", () => {
    expect(pageStarts(schema.node("doc", null, [p(349)]))).toEqual([]);
    expect(pageStarts(schema.node("doc", null, [p(0)]))).toEqual([]);
  });

  it("says it is an estimate and is offered in the view menu", () => {
    expect(marksHr.pages.mark(4)).toBe("≈ str. 4");
    expect(marksHr.pages.title).toContain("procjena");
    const shell = readFileSync(join(__dirname, "..", "shell", "ShellView.tsx"), "utf8");
    expect(shell).toContain("onClick={() => keepPageEstimate(!pagesOn)}>{marksHr.pages.toggle}");
    const host = readFileSync(join(__dirname, "MarksHost.tsx"), "utf8");
    expect(host).toContain("pageStarts(editor.state.doc)");
  });
});
