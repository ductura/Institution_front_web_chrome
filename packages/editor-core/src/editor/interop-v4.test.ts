// @vitest-environment node
import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { FIXTURE_V4, nid } from "../document/document/fixture-v4";
import type { CanonicalDocumentV4 } from "../document/document/schema";
import { canonicalizeJcs } from "../document/forensics/jcs";
import { NODE_ID_ATTRIBUTE, type TiptapNodeJSON } from "./interop";
import { canonicalToTiptapV4, tiptapToCanonicalV4, type TiptapDocumentJSONV4 } from "./interop-v4";
import { createEditorExtensionsV4 } from "./schema";

/** Synthetic data only (contract v4 §12): invented text and ids. */
const schema = getSchema(createEditorExtensionsV4());
const P = nid("aaaaaaaa-aaaa-4aaa-8aaa-0000000000aa");
const minted = (n: number) => nid(`bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}`);

function through(json: unknown) {
  const node = schema.nodeFromJSON(json);
  node.check();
  return node.toJSON() as TiptapDocumentJSONV4;
}

function withBlock(block: TiptapNodeJSON): TiptapDocumentJSONV4 {
  return { type: "doc", attrs: { sources: [], cover: null }, content: [block] };
}

function codes(result: ReturnType<typeof tiptapToCanonicalV4>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

describe("document v4 ↔ Tiptap JSON", () => {
  it("round-trips the fixture through the editor schema, JCS-equal", () => {
    const result = tiptapToCanonicalV4(through(canonicalToTiptapV4(FIXTURE_V4)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(canonicalizeJcs(result.doc)).toBe(canonicalizeJcs(FIXTURE_V4));
  });

  it("gives every block and atom the node and attribute names of the contract (§9)", () => {
    const json = canonicalToTiptapV4(FIXTURE_V4);
    expect(json.attrs.cover).toEqual(FIXTURE_V4.cover);
    expect(json.content.map((node) => node.type)).toEqual(FIXTURE_V4.nodes.map((node) => node.type));
    const box = json.content[4]!;
    expect(box.attrs).toEqual({ [NODE_ID_ATTRIBUTE]: FIXTURE_V4.nodes[4]!.id, kind: "theorem" });
    expect(box.content![0]!.attrs).toEqual({ [NODE_ID_ATTRIBUTE]: nid("aaaaaaaa-aaaa-4aaa-8aaa-000000000006"), variantGroup: null });
    const marks = json.content[1]!.content!.flatMap((child) => child.marks ?? []);
    expect(marks).toContainEqual({ type: "highlight", attrs: { color: "#f2d24b" } });
    expect(marks).toContainEqual({ type: "paste", attrs: { pasteId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", sourceId: null } });
    expect(through(json).content[5]!.attrs).toMatchObject({ headerFill: "#dce6f2", title: "Kućno kompostiranje po gradovima" });
  });

  it("writes absent optional fields as null and leaves them out again", () => {
    const doc: CanonicalDocumentV4 = {
      schemaVersion: 4,
      sources: [],
      nodes: [
        { type: "table", id: P, rows: [["a"]], header: false, stripes: false, landscape: true },
        { type: "image", id: minted(1), widthPercent: 20, align: "left", landscape: false },
        { type: "codeBlock", id: minted(2), children: [] },
      ],
    };
    const json = through(canonicalToTiptapV4(doc));
    expect(json.attrs.cover).toBeNull();
    expect(json.content[0]!.attrs).toMatchObject({ headerFill: null, cellFills: null, merges: null, title: null, source: null });
    expect(json.content[1]!.attrs).toMatchObject({ attachmentId: null, attachmentSha256: null, crop: null });
    expect(json.content[2]!.attrs).toMatchObject({ language: null, caption: null });
    expect(tiptapToCanonicalV4(json)).toEqual({ ok: true, doc });
  });

  it("reads empty optional strings and arrays as absent", () => {
    const table = { type: "table", attrs: { rows: [["a"]], header: false, stripes: false, landscape: false, cellFills: [], title: "" } };
    const result = tiptapToCanonicalV4({ ...withBlock(table), attrs: { sources: [], cover: { study: "", place: null } } }, () => P);
    expect(result).toEqual({
      ok: true,
      doc: { schemaVersion: 4, sources: [], nodes: [{ type: "table", id: P, rows: [["a"]], header: false, stripes: false, landscape: false }] },
    });
  });

  it("orders marks canonically whatever order the editor gives", () => {
    const text = { type: "text", text: "x", marks: [{ type: "link", attrs: { href: "https://primjer.invalid/" } }, { type: "bold" }] };
    const result = tiptapToCanonicalV4(withBlock({ type: "paragraph", attrs: { nodeId: P }, content: [text] }));
    expect(result.ok && result.doc.nodes[0]).toMatchObject({ children: [{ marks: ["bold", { href: "https://primjer.invalid/", type: "link" }] }] });
  });

  it("refuses an unknown key or attribute on an atom, never drops it", () => {
    const formula = { type: "formula", attrs: { nodeId: P, tex: "x", numbered: true } };
    expect(codes(tiptapToCanonicalV4(withBlock(formula)))).toEqual(["TIPTAP_CITATION_INVALID"]);
    const leaf = { type: "pageBreak", attrs: { nodeId: P }, content: [] };
    expect(codes(tiptapToCanonicalV4(withBlock(leaf)))).toEqual(["TIPTAP_CITATION_INVALID"]);
    const inline = { type: "inlineFormula", attrs: { tex: "x", display: true } };
    expect(codes(tiptapToCanonicalV4(withBlock({ type: "paragraph", content: [inline] })))).toEqual(["TIPTAP_CITATION_INVALID"]);
  });

  it("refuses a mark on an inline atom and an unknown mark attribute", () => {
    const inline = { type: "inlineFormula", attrs: { tex: "x" }, marks: [{ type: "bold" }] };
    expect(codes(tiptapToCanonicalV4(withBlock({ type: "paragraph", content: [inline] })))).toEqual(["TIPTAP_CITATION_MARKED"]);
    const text = { type: "text", text: "x", marks: [{ type: "highlight", attrs: { color: "#f2d24b", alpha: 1 } }] };
    expect(codes(tiptapToCanonicalV4(withBlock({ type: "paragraph", content: [text] })))).toEqual(["UNKNOWN_FIELD"]);
    const twice = { type: "text", text: "x", marks: [{ type: "lang", attrs: { lang: "en" } }, { type: "lang", attrs: { lang: "de" } }] };
    expect(codes(tiptapToCanonicalV4(withBlock({ type: "paragraph", content: [twice] })))).toEqual(["MARKS_DUPLICATE"]);
  });

  it("never lets an empty formula through", () => {
    expect(codes(tiptapToCanonicalV4(withBlock({ type: "formula", attrs: { nodeId: P, tex: "" } })))).toEqual(["FORMULA_TEX_INVALID"]);
    expect(codes(tiptapToCanonicalV4(withBlock({ type: "formula", attrs: { nodeId: P } })))).toEqual(["FORMULA_TEX_INVALID"]);
    const inline = { type: "inlineFormula", attrs: { tex: " " } };
    expect(codes(tiptapToCanonicalV4(withBlock({ type: "paragraph", content: [inline] })))).toEqual(["FORMULA_TEX_INVALID"]);
  });

  it("takes numbers only as integers", () => {
    const image = { type: "image", attrs: { nodeId: P, widthPercent: 60.5, align: "center", landscape: false } };
    expect(codes(tiptapToCanonicalV4(withBlock(image)))).toEqual(["IMAGE_LAYOUT_INVALID"]);
    const merges = [{ row: 0, column: 0, rowSpan: 1, columnSpan: 1.5 }];
    const table = { type: "table", attrs: { nodeId: P, rows: [["a", ""]], header: false, stripes: false, landscape: false, merges } };
    expect(codes(tiptapToCanonicalV4(withBlock(table)))).toEqual(["TABLE_MERGE_INVALID"]);
  });

  it("refuses attributes that are not JSON data before cloning them", () => {
    const formula = { type: "formula", attrs: { nodeId: P, tex: () => "x" } };
    expect(codes(tiptapToCanonicalV4(withBlock(formula)))).toEqual(["TIPTAP_ATTRS_NOT_OBJECT"]);
    expect(codes(tiptapToCanonicalV4({ ...withBlock({ type: "paragraph" }), attrs: { sources: [], cover: "Zagreb" } }))).toEqual(["COVER_INVALID"]);
  });

  it("mints ids for a box and its paragraphs and re-mints a repeated one", () => {
    let n = 0;
    const box = { type: "box", attrs: { kind: "remark" }, content: [{ type: "paragraph", attrs: { nodeId: P } }, { type: "paragraph", attrs: { nodeId: P } }] };
    const result = tiptapToCanonicalV4(withBlock(box), () => minted(++n));
    expect(result.ok && result.doc.nodes[0]).toEqual({
      type: "box",
      id: minted(1),
      kind: "remark",
      children: [
        { type: "paragraph", id: P, children: [] },
        { type: "paragraph", id: minted(2), children: [] },
      ],
    });
  });

  it("leaves what a box or a code block cannot hold to the validator", () => {
    const nested = { type: "box", attrs: { nodeId: P, kind: "proof" }, content: [{ type: "box", attrs: { kind: "proof" }, content: [{ type: "paragraph" }] }] };
    expect(codes(tiptapToCanonicalV4(withBlock(nested)))).toEqual(["BOX_CHILDREN_INVALID"]);
    const code = { type: "codeBlock", attrs: { nodeId: P }, content: [{ type: "text", text: "x", marks: [{ type: "bold" }] }] };
    expect(codes(tiptapToCanonicalV4(withBlock(code)))).toEqual(["CODE_CONTENT_INVALID"]);
    const heading = { type: "heading", attrs: { nodeId: P, level: 1 }, content: [{ type: "inlineFormula", attrs: { tex: "x" } }] };
    expect(codes(tiptapToCanonicalV4(withBlock(heading)))).toEqual(["INLINE_FORMULA_NOT_ALLOWED"]);
  });
});
