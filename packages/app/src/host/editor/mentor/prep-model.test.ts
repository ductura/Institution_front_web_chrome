// WEB-NF6-RUNDA (MK-10): the preparation composed in the browser. Invented records and requests only.
import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import type { RevisionRequest } from "../../../../../../src/client/revision-requests";

import { prepText } from "./mentor-model";
import { changedBlocks, docWords, lastRecord, prepFrom, resolvedSince, textWords } from "./prep-model";

const answered = (state: RevisionRequest["state"], window: string | null) => ({
  id: `${state}-${window}`, state,
  versions: [{ response: window === null ? null : { window }, closed: null }],
}) as unknown as RevisionRequest;

describe("prep model", () => {
  it("takes the newest consultation record", () => {
    expect(lastRecord([{ heldOn: "2026-11-02", revision: 3 }, { heldOn: "2026-11-09", revision: 5 }, { heldOn: "2026-11-09", revision: 7 }]))
      .toEqual({ heldOn: "2026-11-09", revision: 7 });
    expect(lastRecord([])).toBeNull();
  });
  it("counts only new or rewritten blocks of text, not headings", () => {
    expect(changedBlocks([
      { kind: "paragraph", change: "added" }, { kind: "paragraph", change: "removed" },
      { kind: "heading", change: "added" }, { kind: "quote", change: "added" }, { kind: "paragraph", change: "unchanged" },
    ])).toBe(2);
  });
  it("counts the requests answered since the record", () => {
    const list = [answered("responded", "2026-11-10T08:00:00.000Z"), answered("accepted", "2026-11-01T08:00:00.000Z"), answered("open", null)];
    expect(resolvedSince(list, "2026-11-09")).toBe(1);
    expect(resolvedSince(list, null)).toBe(2);
  });
  it("leaves out what it could not read, and never claims an agreed task", () => {
    const input = prepFrom({ record: null, blocks: null, requests: null, words: 1200 });
    expect(input).toMatchObject({ since: null, changed: null, resolved: null, openComments: null, agreed: [] });
    expect(prepText(input).split("\n")).toEqual(["Priprema za konzultacije", "Opseg: 1200 riječi", "Što trebam od mentora:"]);
  });
  it("composes the whole text from a record, a comparison and requests", () => {
    const input = prepFrom({
      record: { heldOn: "2026-11-09", revision: 5 }, blocks: [{ kind: "paragraph", change: "added" }],
      requests: [answered("responded", "2026-11-10T08:00:00.000Z"), answered("open", null)], words: null,
    });
    const lines = prepText(input).split("\n");
    expect(lines[1]).toMatch(/^Od konzultacija .* · izmijenjeno odlomaka: 1 · riješeni komentari: 1$/);
    expect(lines).toContain("Otvoreni komentari: 1");
  });
  it("counts words", () => {
    expect(textWords("  Izmišljeni   tekst rada \n")).toBe(3);
  });
  it("counts the words of a document block by block (#631 review, point 1)", () => {
    const schema = new Schema({ nodes: { doc: { content: "block+" }, paragraph: { group: "block", content: "text*" },
      bulletList: { group: "block", content: "paragraph+" }, text: {} } });
    const p = (text: string) => schema.node("paragraph", null, [schema.text(text)]);
    const doc = schema.node("doc", null, [p("a b"), p("c d"), schema.node("bulletList", null, [p("e"), p("f g")])]);
    // The joined text ("a bc def g") reads as 4 words; block by block it is 7.
    expect(textWords(doc.textContent)).toBe(4);
    expect(docWords(doc)).toBe(7);
  });
  it("a hard line break inside a paragraph separates words (#631 review, c.7144836874)", () => {
    const schema = new Schema({ nodes: { doc: { content: "block+" }, paragraph: { group: "block", content: "inline*" },
      hardBreak: { group: "inline", inline: true }, text: { group: "inline" } } });
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("a"), schema.node("hardBreak"), schema.text("b c")])]);
    // textContent drops the break and reads "ab c" as 2 words.
    expect(textWords(doc.textContent)).toBe(2);
    expect(docWords(doc)).toBe(3);
  });
});
