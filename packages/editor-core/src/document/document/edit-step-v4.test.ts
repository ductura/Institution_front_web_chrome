import { describe, expect, it } from "vitest";

import { EDIT_STEP_FORMAT_V3, EDIT_STEP_FORMAT_V4, parseEditSteps } from "./edit-step";

const HASH = "a".repeat(64);
const ID = "11111111-1111-4111-8111-111111111111";
const GROUP = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PASTE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const parse = (steps: unknown[], format: string = EDIT_STEP_FORMAT_V4) => parseEditSteps(format, steps);
const code = (steps: unknown[], format?: string) => {
  const result = parse(steps, format);
  return result.ok ? "ok" : `${result.code}`;
};
const text = (value: string, marks?: unknown[]) => ({ ...(marks ? { marks } : {}), text: value, type: "text" });
const insertText = (...content: unknown[]) => ({ stepType: "replace", from: 3, to: 3, slice: { content } });
const table = (extra: Record<string, unknown> = {}) => ({
  header: true,
  landscape: false,
  nodeId: null,
  rows: [["a", "b"], ["", "c"]],
  stripes: false,
  type: "table",
  ...extra,
});

describe("ductus-edit-steps-v4 · marks", () => {
  it("reads every mark with its attributes as ProseMirror writes them", () => {
    const marks = [
      { type: "bold" },
      { type: "italic" },
      { type: "sup" },
      { attrs: { color: "#f2d24b" }, type: "highlight" },
      { attrs: { lang: "en" }, type: "lang" },
      { attrs: { href: "https://primjer.invalid/" }, type: "link" },
      { attrs: { pasteId: PASTE, sourceId: null }, type: "paste" },
      { type: "imported" },
    ];
    expect(code([insertText(text("x", marks))])).toBe("ok");
  });

  it.each([
    ["wrong order", [{ type: "italic" }, { type: "bold" }]],
    ["repeated type", [{ attrs: { lang: "en" }, type: "lang" }, { attrs: { lang: "de" }, type: "lang" }]],
    ["sup with sub", [{ type: "sup" }, { type: "sub" }]],
    ["no attrs on a mark that needs them", [{ type: "highlight" }]],
    ["attrs on a plain mark", [{ attrs: { a: "b" }, type: "bold" }]],
  ])("refuses %s", (_name, marks) => {
    expect(code([insertText(text("x", marks))])).toMatch(/invalid_mark|missing_field|unknown_field|not_object/);
  });

  it.each([
    [{ attrs: { color: "#F2D24B" }, type: "highlight" }],
    [{ attrs: { lang: "EN" }, type: "lang" }],
    [{ attrs: { href: "javascript:alert(1)" }, type: "link" }],
    [{ attrs: { pasteId: "00000000-0000-0000-0000-000000000000", sourceId: null }, type: "paste" }],
  ])("refuses an invalid attribute %j", (mark) => {
    expect(code([insertText(text("x", [mark]))])).toBe("invalid_value");
  });

  it("refuses addMark and removeMark for paste and imported", () => {
    for (const stepType of ["addMark", "removeMark"]) {
      expect(code([{ stepType, from: 2, to: 5, mark: { type: "imported" } }])).toBe("invalid_mark");
      expect(code([{ stepType, from: 2, to: 5, mark: { attrs: { pasteId: PASTE, sourceId: null }, type: "paste" } }])).toBe("invalid_mark");
      expect(code([{ stepType, from: 2, to: 5, mark: { attrs: { color: "#f2d24b" }, type: "highlight" } }])).toBe("ok");
      expect(code([{ stepType, from: 2, to: 5, mark: { type: "sub" } }])).toBe("ok");
    }
  });

  it("v3 refuses everything v4 adds", () => {
    expect(code([insertText(text("x", [{ type: "imported" }]))], EDIT_STEP_FORMAT_V3)).toBe("invalid_mark");
    expect(code([insertText({ tex: "x", type: "inlineFormula" })], EDIT_STEP_FORMAT_V3)).toBe("invalid_node");
    expect(code([{ stepType: "coverSet", cover: { place: "Zagreb" } }], EDIT_STEP_FORMAT_V3)).toBe("unknown_step_type");
  });
});

describe("ductus-edit-steps-v4 · blocks, atoms", () => {
  const blockStep = (...content: unknown[]) => ({ stepType: "replace", from: 0, to: 0, slice: { content } });
  const para = (extra: Record<string, unknown> = {}, content?: unknown[]) => ({
    attrs: { nodeId: null, variantGroup: null, ...extra },
    ...(content ? { content } : {}),
    type: "paragraph",
  });

  it("reads an inline formula and refuses a blank or oversized one", () => {
    expect(code([insertText({ tex: "x^{2}", type: "inlineFormula" })])).toBe("ok");
    expect(code([insertText({ tex: "", type: "inlineFormula" })])).toBe("invalid_value");
    expect(code([insertText({ tex: "x".repeat(1001), type: "inlineFormula" })])).toBe("invalid_value");
    expect(code([insertText({ tex: "a\nb", type: "inlineFormula" })])).toBe("invalid_value");
  });

  it("reads atom blocks in document form with nodeId and refuses the others", () => {
    expect(code([blockStep(table())])).toBe("ok");
    expect(code([blockStep({ nodeId: null, tex: "\\frac{1}{2}", type: "formula" })])).toBe("ok");
    expect(code([blockStep({ nodeId: null, type: "pageBreak" })])).toBe("ok");
    expect(code([blockStep({ align: "center", landscape: false, nodeId: null, type: "image", widthPercent: 60 })])).toBe("ok");
    expect(code([blockStep(table({ rows: [["a"], ["a", "b"]] }))])).toBe("invalid_value");
    expect(code([blockStep(table({ header: 0 }))])).toBe("invalid_value");
    expect(code([blockStep(table({ extra: 1 }))])).toBe("unknown_field");
    expect(code([blockStep({ nodeId: null, type: "pageBreak", id: ID })])).toBe("unknown_field");
    expect(code([blockStep(table({ nodeId: ID }))])).toBe("new_block_has_id");
  });

  it("an atom that replaces an atom block continues it: nodeId and hash allowed", () => {
    const replacement = { stepType: "replace", from: 5, to: 6, removedSha256: HASH, slice: { content: [table({ nodeId: ID })] } };
    const { removedSha256: _hash, ...unhashed } = replacement;
    expect(code([replacement])).toBe("ok");
    expect(code([unhashed])).toBe("missing_field");
    expect(code([{ ...replacement, to: 7 }])).toBe("new_block_has_id");
  });

  it("an atom block can be put in at a block boundary and removed at position 0", () => {
    expect(code([{ stepType: "replace", from: 7, to: 7, slice: { content: [{ nodeId: null, type: "pageBreak" }] } }])).toBe("ok");
    expect(code([{ stepType: "replace", from: 0, to: 1, removedSha256: HASH }])).toBe("ok");
  });

  it("reads code blocks, boxes and paragraphs with a variant group", () => {
    expect(code([blockStep(para({ variantGroup: GROUP }, [text("a")]))])).toBe("ok");
    expect(code([blockStep(para({ variantGroup: "x" }))])).toBe("invalid_value");
    const code1 = { attrs: { caption: null, language: "python", nodeId: null }, content: [text("x = 1", [{ type: "imported" }])], type: "codeBlock" };
    expect(code([blockStep(code1)])).toBe("ok");
    expect(code([blockStep({ ...code1, content: [text("x", [{ type: "bold" }])] })])).toBe("invalid_node");
    expect(code([blockStep({ ...code1, attrs: { ...code1.attrs, language: "cobol" } })])).toBe("invalid_value");
    expect(code([blockStep({ ...code1, content: [{ tex: "x", type: "inlineFormula" }] })])).toBe("invalid_node");
    const box = { attrs: { kind: "theorem", nodeId: null }, content: [para({}, [text("a")])], type: "box" };
    expect(code([blockStep(box)])).toBe("ok");
    expect(code([blockStep({ ...box, attrs: { kind: "axiom", nodeId: null } })])).toBe("invalid_value");
    expect(code([blockStep({ ...box, content: [box] })])).toBe("invalid_node");
    expect(code([blockStep({ ...box, content: [table()] })])).toBe("invalid_node");
    const heading = { attrs: { level: 1, nodeId: null }, content: [{ tex: "x", type: "inlineFormula" }], type: "heading" };
    expect(code([blockStep(heading)])).toBe("invalid_node");
  });
});

describe("ductus-edit-steps-v4 · replaceAround, coverSet", () => {
  const box = { attrs: { kind: "definition", nodeId: null }, type: "box" };
  it("reads wrap, lift and a markup change", () => {
    expect(code([{ stepType: "replaceAround", from: 0, to: 6, gapFrom: 0, gapTo: 6, insert: 1, structure: true, slice: { content: [box] } }])).toBe("ok");
    expect(code([{ stepType: "replaceAround", from: 0, to: 8, gapFrom: 1, gapTo: 7, insert: 0, structure: true }])).toBe("ok");
    expect(code([{ stepType: "replaceAround", from: 0, to: 6, gapFrom: 1, gapTo: 5, insert: 1, structure: true, slice: { content: [{ attrs: { nodeId: ID, variantGroup: null }, type: "paragraph" }] } }])).toBe("ok");
    expect(code([{ stepType: "replaceAround", from: 0, to: 6, gapFrom: 0, gapTo: 6, insert: 1, structure: true, slice: { content: [{ attrs: { nodeId: null, variantGroup: null }, type: "paragraph" }] } }])).toBe("invalid_slice");
    expect(code([{ stepType: "replaceAround", from: 0, to: 6, gapFrom: 2, gapTo: 5, insert: 1, structure: true, slice: { content: [box] } }])).toBe("invalid_position");
  });

  it("coverSet sets or removes the whole cover", () => {
    expect(code([{ stepType: "coverSet", cover: { date: "studeni 2026.", place: "Zagreb" } }])).toBe("ok");
    expect(code([{ stepType: "coverSet", cover: { place: "Zagreb" }, removedSha256: HASH }])).toBe("ok");
    expect(code([{ stepType: "coverSet", removedSha256: HASH }])).toBe("ok");
    expect(code([{ stepType: "coverSet" }])).toBe("missing_field");
    expect(code([{ stepType: "coverSet", cover: {} }])).toBe("invalid_value");
    expect(code([{ stepType: "coverSet", cover: { place: " Zagreb" } }])).toBe("invalid_value");
    expect(code([{ stepType: "coverSet", cover: { place: "Zagreb" }, removedSha256: "ABC" }])).toBe("invalid_removed_hash");
  });

  it("is a closed format: a time field or a prototype key has nowhere to sit", () => {
    expect(code([{ stepType: "coverSet", cover: { place: "Zagreb" }, at: 1 }])).toBe("unknown_field");
    expect(code([{ stepType: "attr", pos: 1, attr: "nodeId", value: ID, ["__proto__"]: 1 }])).toBe("forbidden_key");
    expect(parseEditSteps("ductus-edit-steps-v5", [])).toEqual({ ok: false, code: "unsupported_format", path: "$" });
  });

  it("keeps the other steps of v3 working under v4", () => {
    expect(code([{ stepType: "attr", pos: 0, attr: "nodeId", value: ID }])).toBe("ok");
    expect(code([insertText(text("abc"))])).toBe("ok");
    expect(code([{ stepType: "replace", from: 3, to: 5, removedSha256: HASH }])).toBe("ok");
  });
});
