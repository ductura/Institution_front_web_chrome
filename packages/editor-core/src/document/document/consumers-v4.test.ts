import { describe, expect, it } from "vitest";

import { canonicalizeJcs } from "../forensics/jcs";

import {
  canonicalMarksV4,
  contentEqualV4,
  documentWordCountV4,
  documentsEqualV4,
  normalizeDocumentV4,
  textBlocksOfV4,
} from "./consumers-v4";
import { FIXTURE_V4, nid } from "./fixture-v4";
import { validateDocumentV4 } from "./validate-v4";
import type { CanonicalDocumentV4 } from "./schema";

const clone = (): CanonicalDocumentV4 => structuredClone(FIXTURE_V4);

describe("document v4 fixture and validator (image, cover)", () => {
  it("is valid and equal to its validated copy", () => {
    const outcome = validateDocumentV4(FIXTURE_V4);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(documentsEqualV4(outcome.doc, FIXTURE_V4)).toBe(true);
  });

  const imageCodes = (patch: Record<string, unknown>, drop: string[] = []): string[] => {
    const doc = clone() as unknown as { nodes: Record<string, unknown>[] };
    const image = { ...doc.nodes[6], ...patch };
    drop.forEach((key) => delete image[key]);
    doc.nodes[6] = image;
    const outcome = validateDocumentV4(doc);
    return outcome.ok ? [] : outcome.errors.map((e) => e.code);
  };

  it.each([
    ["only attachmentId", {}, ["attachmentSha256"], "IMAGE_ATTACHMENT_INVALID"],
    ["upper-case hash", { attachmentSha256: "A".repeat(64) }, [], "IMAGE_ATTACHMENT_INVALID"],
    ["crop without attachment", {}, ["attachmentId", "attachmentSha256"], "IMAGE_CROP_INVALID"],
    ["crop all zero", { crop: { bottom: 0, left: 0, right: 0, top: 0 } }, [], "IMAGE_CROP_INVALID"],
    ["crop 46", { crop: { bottom: 0, left: 46, right: 0, top: 0 } }, [], "IMAGE_CROP_INVALID"],
    ["width 19", { widthPercent: 19 }, [], "IMAGE_LAYOUT_INVALID"],
    ["width 101", { widthPercent: 101 }, [], "IMAGE_LAYOUT_INVALID"],
    ["width 60.5", { widthPercent: 60.5 }, [], "IMAGE_LAYOUT_INVALID"],
    ["align centre", { align: "centre" }, [], "IMAGE_LAYOUT_INVALID"],
    ["landscape 0", { landscape: 0 }, [], "BLOCK_FLAG_INVALID"],
    ["unknown key", { extra: 1 }, [], "UNKNOWN_FIELD"],
  ])("image: %s", (_name, patch, drop, code) => {
    expect(imageCodes(patch, drop)).toContain(code);
  });

  it("accepts an image without an attachment", () => {
    expect(imageCodes({}, ["attachmentId", "attachmentSha256", "crop"])).toEqual([]);
  });

  it.each([
    [{}, "COVER_INVALID"],
    [{ study: "x".repeat(201) }, "COVER_FIELD_INVALID"],
    [{ place: " Zagreb" }, "COVER_FIELD_INVALID"],
    [{ date: "x".repeat(51) }, "COVER_FIELD_INVALID"],
    [{ other: "x" }, "UNKNOWN_FIELD"],
  ])("cover %j is %s", (cover, code) => {
    const outcome = validateDocumentV4({ ...clone(), cover });
    expect(outcome.ok ? [] : outcome.errors.map((e) => e.code)).toContain(code);
  });

  it("accepts a cover with a field on its limit", () => {
    expect(validateDocumentV4({ ...clone(), cover: { study: "x".repeat(200), place: "y".repeat(100), date: "z".repeat(50) } }).ok).toBe(true);
  });
});

describe("document v4 consumers", () => {
  it("normalization keeps a normalized document byte-equal and is idempotent", () => {
    const once = normalizeDocumentV4(FIXTURE_V4);
    expect(canonicalizeJcs(once)).toBe(canonicalizeJcs(FIXTURE_V4));
    expect(normalizeDocumentV4(once)).toEqual(once);
  });

  it("merges adjacent text with equal attribute marks, also in a code block, and drops empty text", () => {
    const doc = clone();
    doc.nodes[1] = {
      type: "paragraph",
      id: nid("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      children: [
        { type: "text", text: "a", marks: [{ lang: "en", type: "lang" }] },
        { type: "text", text: "b", marks: [{ lang: "en", type: "lang" }] },
        { type: "text", text: "", marks: [] },
        { type: "text", text: "c", marks: [{ lang: "de", type: "lang" }] },
      ],
    };
    doc.nodes[3] = {
      type: "codeBlock",
      id: nid("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
      children: [
        { type: "text", text: "x", marks: ["imported"] },
        { type: "text", text: "y", marks: ["imported"] },
      ],
    };
    const normalized = normalizeDocumentV4(doc);
    expect((normalized.nodes[1] as { children: unknown[] }).children).toEqual([
      { type: "text", text: "ab", marks: [{ lang: "en", type: "lang" }] },
      { type: "text", text: "c", marks: [{ lang: "de", type: "lang" }] },
    ]);
    expect((normalized.nodes[3] as { children: unknown[] }).children).toEqual([{ type: "text", text: "xy", marks: ["imported"] }]);
  });

  it("sorts and de-duplicates marks by canonical order", () => {
    expect(canonicalMarksV4(["imported", "italic", "bold", "bold"])).toEqual(["bold", "italic", "imported"]);
  });

  it("restores one empty paragraph for a document without blocks", () => {
    const empty = normalizeDocumentV4({ schemaVersion: 4, nodes: [], sources: [] }, () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(empty.nodes).toHaveLength(1);
  });

  it("equality tells an absent field from a present one and a block id from content", () => {
    const withoutCover = clone();
    delete withoutCover.cover;
    expect(documentsEqualV4(FIXTURE_V4, withoutCover)).toBe(false);
    const renamed = clone();
    renamed.nodes[0]!.id = nid("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(documentsEqualV4(FIXTURE_V4, renamed)).toBe(false);
    expect(contentEqualV4(FIXTURE_V4, renamed)).toBe(true);
  });

  it("text blocks: box paragraphs apart, code with its text, atoms without characters", () => {
    const blocks = textBlocksOfV4(FIXTURE_V4);
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "codeBlock", "paragraph", "paragraph"]);
    expect(blocks[1]!.text).toBe("Prvi drugi x2 compost veza zalijepljeno uvezeno");
    expect(blocks[2]!.text).toContain("def prosjek");
  });

  it("word count: body text only, inline formula separates words", () => {
    expect(documentWordCountV4(FIXTURE_V4)).toBe(2 + 7 + 5);
    const doc = clone();
    doc.nodes = [
      {
        type: "paragraph",
        id: nid("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
        children: [
          { type: "text", text: "Prva", marks: [] },
          { type: "inlineFormula", tex: "x" },
          { type: "text", text: "riječ", marks: [] },
        ],
      },
    ];
    expect(documentWordCountV4(doc)).toBe(2);
  });
});
