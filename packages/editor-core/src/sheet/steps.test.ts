// WEB-V14-SHEET-JOURNAL: the spreadsheet steps. Vectors are the server's
// (edit-step-vectors.json, derived outside the code); all ids and texts are invented.
import { describe, expect, it } from "vitest";
import vectors from "./edit-step-vectors.json";
import { canonicalizeJcs } from "../document/forensics/jcs.ts";
import {
  SHEET_STEP_FORMAT_V1, applySheetStep, applySheetSteps, parseSheetStep, parseSheetSteps,
  sheetCellSha256, sheetCellsSha256, sheetDocumentSha256, sheetRevisionZeroDocument, sheetTextSha256,
  type SheetStep,
} from "./steps.ts";
import type { SheetDocument } from "./model.ts";

const V = vectors as unknown as {
  revisionZero: { jcs: string; sha256: string };
  chain: { steps: unknown[]; finalJcs: string; finalSha256: string };
  removedHashes: Record<string, { sha256: string; cell?: unknown; cells?: unknown }>;
};
const S = "00000000-0000-4000-8000-000000000000";
const OTHER = "11111111-1111-4111-8111-111111111111";
const zero = sheetRevisionZeroDocument();
const set = (ref: string, value: string | number, replacedSha256?: string) =>
  ({ type: "cellSet", sheetId: S, ref, value, ...(replacedSha256 === undefined ? {} : { replacedSha256 }) });

async function apply(doc: SheetDocument, ...steps: unknown[]): Promise<SheetDocument> {
  const parsed = parseSheetSteps(steps);
  if (!parsed.ok) throw new Error(`parse: ${parsed.error}`);
  const applied = await applySheetSteps(doc, parsed.steps);
  if (!applied.ok) throw new Error(`apply: ${applied.error} at ${applied.index}`);
  return applied.doc;
}
async function refused(doc: SheetDocument, step: unknown) {
  const parsed = parseSheetStep(step);
  if (!parsed.ok) throw new Error(`parse: ${parsed.error}`);
  const applied = await applySheetStep(doc, parsed.step);
  return applied.ok ? null : applied.error;
}

describe("sheet steps: parity with the server vectors", () => {
  it("names the same format as the server", () => expect(SHEET_STEP_FORMAT_V1).toBe("ductus-sheet-steps-v1"));
  it("revision 0 is the known-answer document", async () => {
    expect(canonicalizeJcs(zero as never)).toBe(V.revisionZero.jcs);
    expect(await sheetDocumentSha256(zero)).toBe(V.revisionZero.sha256);
  });
  it("gives the recorded final document for the recorded chain", async () => {
    const final = await apply(zero, ...V.chain.steps);
    expect(canonicalizeJcs(final as never)).toBe(V.chain.finalJcs);
    expect(await sheetDocumentSha256(final)).toBe(V.chain.finalSha256);
  });
  it("hashes removed content as recorded", async () => {
    const r = V.removedHashes;
    expect(await sheetCellSha256(r.cell!.cell as never)).toBe(r.cell!.sha256);
    expect(await sheetCellsSha256(r.row2!.cells as never)).toBe(r.row2!.sha256);
    expect(await sheetCellsSha256(r.column3!.cells as never)).toBe(r.column3!.sha256);
    expect(await sheetCellsSha256({})).toBe(r.emptyRow!.sha256);
    expect(await sheetTextSha256("List1")).toBe(r.sheetName!.sha256);
  });
});

describe("parseSheetStep", () => {
  const ok = { type: "cellSet", sheetId: S, ref: "B2", value: 3 };
  it("reads a valid step as a fresh copy", () => {
    const parsed = parseSheetStep(ok);
    expect(parsed).toEqual({ ok: true, step: ok });
    if (parsed.ok) expect(parsed.step).not.toBe(ok);
  });
  it.each([
    ["an unknown type", { type: "cellDrop", sheetId: S }, "unknown_step"],
    ["a non-object", "cellSet", "not_an_object"],
    ["an unknown field", { ...ok, at: 1 }, "step_invalid"],
    ["a time field", { ...ok, timestamp: 1 }, "step_invalid"],
    ["an uppercase sheet id", { ...ok, sheetId: S.replace(/0/g, "A").toUpperCase() }, "step_invalid"],
    ["a row beyond the grid", { ...ok, ref: "A201" }, "step_invalid"],
    ["a value and a formula", { ...ok, formula: "=1" }, "step_invalid"],
    ["a boolean value", { ...ok, value: true }, "step_invalid"],
    ["an infinite value", { ...ok, value: Infinity }, "step_invalid"],
    ["a formula over 500 points", { type: "cellSet", sheetId: S, ref: "A1", formula: `=${"1".repeat(500)}` }, "step_invalid"],
    ["a clear without its hash", { type: "cellClear", sheetId: S, ref: "A1" }, "step_invalid"],
    ["a fractional row", { type: "rowInsert", sheetId: S, row: 1.5 }, "step_invalid"],
    ["a removal without its hash", { type: "rowRemove", sheetId: S, row: 1 }, "step_invalid"],
  ])("refuses %s", (_n, raw, error) => expect(parseSheetStep(raw)).toEqual({ ok: false, error }));
  it("refuses a lone surrogate and __proto__ instead of throwing", () => {
    expect(parseSheetStep({ ...ok, value: "a\ud800b" })).toEqual({ ok: false, error: "step_invalid" });
    expect(parseSheetStep(JSON.parse(`{"type":"rowInsert","sheetId":"${S}","row":1,"__proto__":{}}`)).ok).toBe(false);
  });
  it("refuses an empty, sparse or oversized array and names the bad index", () => {
    const sparse: unknown[] = [ok]; sparse[2] = ok;
    expect(parseSheetSteps([])).toEqual({ ok: false, error: "step_invalid" });
    expect(parseSheetSteps(sparse)).toEqual({ ok: false, error: "step_invalid", index: 1 });
    expect(parseSheetSteps([ok, { type: "nope", sheetId: S }])).toEqual({ ok: false, error: "unknown_step", index: 1 });
    expect(parseSheetSteps(Array.from({ length: 1001 }, () => ok))).toEqual({ ok: false, error: "too_many_steps" });
  });
});

describe("applySheetStep", () => {
  it("never changes its input", async () => {
    const before = await sheetDocumentSha256(zero);
    await apply(zero, set("A1", "demo"));
    expect(await sheetDocumentSha256(zero)).toBe(before);
  });
  it("refuses another sheet and cells outside the grid", async () => {
    expect(await refused(zero, { type: "rowInsert", sheetId: OTHER, row: 1 })).toBe("sheet_not_found");
    expect(await refused(zero, set("K1", 1))).toBe("cell_out_of_grid");
    expect(await refused(zero, set("A101", 1))).toBe("cell_out_of_grid");
  });
  it("requires the hash of a replaced cell exactly when a cell is there", async () => {
    const one = await apply(zero, set("A1", "demo"));
    expect(await refused(one, set("A1", "novo"))).toBe("hash_mismatch");
    expect(await refused(zero, set("A1", "novo", "a".repeat(64)))).toBe("hash_mismatch");
    expect(await refused(one, set("A1", "novo", await sheetCellSha256({ value: "demo" })))).toBeNull();
    expect(await refused(one, set("A1", "demo", await sheetCellSha256({ value: "demo" })))).toBe("no_change");
  });
  it("clears a cell only with the hash of what is there", async () => {
    const one = await apply(zero, set("A1", "demo"));
    expect(await refused(one, { type: "cellClear", sheetId: S, ref: "A1", removedSha256: "b".repeat(64) })).toBe("hash_mismatch");
    const cleared = await apply(one, { type: "cellClear", sheetId: S, ref: "A1", removedSha256: await sheetCellSha256({ value: "demo" }) });
    expect(cleared.sheets[0]!.cells).toEqual({});
  });
  it("shifts cells with an inserted row and a removed column", async () => {
    const doc = await apply(zero, set("A1", 1), set("B2", 2), set("C3", 3));
    const inserted = await apply(doc, { type: "rowInsert", sheetId: S, row: 2 });
    expect(Object.keys(inserted.sheets[0]!.cells).sort()).toEqual(["A1", "B3", "C4"]);
    const removed = await apply(doc, { type: "columnRemove", sheetId: S, column: 2, removedSha256: await sheetCellsSha256({ B2: { value: 2 } }) });
    expect(Object.keys(removed.sheets[0]!.cells).sort()).toEqual(["A1", "B3"]);
    expect(removed.sheets[0]!.columns).toBe(9);
  });
  it("refuses a row removal whose content is not the one named", async () => {
    const doc = await apply(zero, set("A2", 1));
    expect(await refused(doc, { type: "rowRemove", sheetId: S, row: 2, removedSha256: await sheetCellsSha256({}) })).toBe("hash_mismatch");
  });
  it("keeps rows and columns inside the limits", async () => {
    expect(await refused(zero, { type: "rowInsert", sheetId: S, row: 102 })).toBe("index_out_of_range");
    const wide = { ...zero, sheets: [{ ...zero.sheets[0]!, rows: 200, columns: 26 }] };
    expect(await refused(wide, { type: "rowInsert", sheetId: S, row: 1 })).toBe("index_out_of_range");
    expect(await refused(wide, { type: "columnInsert", sheetId: S, column: 1 })).toBe("index_out_of_range");
  });
  it("refuses a result the document validator refuses, and a text over its limit", async () => {
    expect(await refused(zero, set("A1", "x".repeat(1001)))).toBe("result_invalid");
    expect(await refused(zero, { type: "sheetRename", sheetId: S, name: "a/b", replacedSha256: await sheetTextSha256("List1") })).toBe("result_invalid");
  });
  it("refuses a document that is not valid to begin with", async () => {
    const parsed = parseSheetStep(set("A1", 1)) as { ok: true; step: SheetStep };
    expect(await applySheetStep({ ...zero, kind: "text" } as never, parsed.step)).toEqual({ ok: false, error: "document_invalid" });
  });
  it("stores a formula as text and never a result; a refused step leaves no trace", async () => {
    const doc = await apply(zero, { type: "cellSet", sheetId: S, ref: "A1", formula: "=1+1" });
    expect(doc.sheets[0]!.cells.A1).toEqual({ value: null, formula: "=1+1" });
    const parsed = parseSheetSteps([set("A1", 1), set("K1", 1)]);
    if (!parsed.ok) throw new Error("parse");
    expect(await applySheetSteps(zero, parsed.steps)).toEqual({ ok: false, error: "cell_out_of_grid", index: 1 });
    expect(await sheetDocumentSha256(zero)).toBe(V.revisionZero.sha256);
  });
});
