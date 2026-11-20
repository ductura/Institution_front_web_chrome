import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { validateTable } from "@/domain/document/validate-table-v4";
import { validateImage } from "@/domain/document/validate-image-cover-v4";
import type { ValidationError } from "@/domain/document/validate";

import { uploadImage, checkFile } from "./attachment";
import { CropDialog } from "./CropDialog";
import { ImageBar } from "./ImageBar";
import { clampWidth, clearCrop, cropInset, normalizeCrop, setCrop, stepWidth, type ImageState } from "./image-ops";
import { TableBar } from "./TableBar";
import {
  addColumnAfter, addRowAfter, canMergeText, deleteColumn, deleteRow, mergeCells, setCellFill, setCellText,
  setHeader, setHeaderFill, tidyCell, unmergeCell, type TableState,
} from "./table-ops";

const ID = "11111111-1111-4111-8111-111111111111" as never;
const base = (): TableState => ({ rows: [["Naziv", "Broj"], ["a", "1"], ["b", "2"]], header: true, stripes: false, landscape: false });
const valid = (t: TableState) => {
  const errors: ValidationError[] = [];
  const out = validateTable({ ...t, type: "table", id: ID } as never, "t", ID, errors);
  return { out, errors };
};

it("keeps the table valid through row and column edits", () => {
  let t = mergeCells(setCellFill(setHeaderFill(base(), "#aabbcc"), { row: 1, column: 0 }, "#ddeeff"), { row: 1, column: 0, rowSpan: 2, columnSpan: 1 });
  expect(valid(t).errors).toEqual([]);
  t = addRowAfter(t, 0);
  expect(t.rows).toHaveLength(4);
  expect(t.merges).toEqual([{ row: 2, column: 0, rowSpan: 2, columnSpan: 1 }]);
  expect(t.cellFills).toEqual([{ row: 2, column: 0, color: "#ddeeff" }]);
  expect(valid(t).errors).toEqual([]);
  t = addColumnAfter(t, 0);
  expect(t.rows.every((r) => r.length === 3)).toBe(true);
  expect(valid(t).errors).toEqual([]);
  t = deleteRow(t, 3);
  expect(t.merges).toBeUndefined();
  expect(valid(t).errors).toEqual([]);
  t = deleteColumn(t, 1);
  expect(valid(t).errors).toEqual([]);
});

it("inserting inside a merge widens it", () => {
  let t = mergeCells(base(), { row: 0, column: 0, rowSpan: 1, columnSpan: 2 });
  t = addColumnAfter(t, 0);
  expect(t.merges).toEqual([{ row: 0, column: 0, rowSpan: 1, columnSpan: 3 }]);
  expect(valid(t).errors).toEqual([]);
});

it("refuses to remove the last row or column", () => {
  const one: TableState = { ...base(), rows: [["x"]] };
  expect(deleteRow(one, 0)).toBe(one);
  expect(deleteColumn(one, 0)).toBe(one);
});

it("merging keeps the text and the header fill goes with the header", () => {
  const t = mergeCells(base(), { row: 1, column: 0, rowSpan: 1, columnSpan: 2 });
  expect(t.rows[1]).toEqual(["a 1", ""]);
  expect(valid(t).errors).toEqual([]);
  expect(mergeCells(t, { row: 1, column: 1, rowSpan: 2, columnSpan: 1 })).toBe(t);
  expect(unmergeCell(t, { row: 1, column: 1 }).merges).toBeUndefined();
  expect(setHeader(setHeaderFill(base(), "#112233"), false).headerFill).toBeUndefined();
  expect(setHeaderFill(setHeader(base(), false), "#112233").headerFill).toBeUndefined();
  expect(setCellFill(t, { row: 1, column: 1 }, "#112233")).toBe(t);
});

it("deleting a merge's anchor line moves its text and fill to the new anchor", () => {
  let t = base();
  t = setCellFill(setCellText(t, { row: 1, column: 0 }, "x"), { row: 1, column: 0 }, "#112233");
  t = mergeCells(t, { row: 1, column: 0, rowSpan: 2, columnSpan: 1 });
  const gone = deleteRow(t, 1);
  expect(gone.rows[1]![0]).toBe(t.rows[1]![0]);
  expect(gone.cellFills).toEqual([{ row: 1, column: 0, color: "#112233" }]);
  expect(gone.merges).toBeUndefined();
  expect(valid(gone).errors).toEqual([]);
  const wide = mergeCells(setCellText(base(), { row: 1, column: 0 }, "p"), { row: 1, column: 0, rowSpan: 1, columnSpan: 2 });
  expect(deleteColumn(wide, 0).rows[1]![0]).toBe(wide.rows[1]![0]);
  expect(valid(deleteColumn(wide, 0)).errors).toEqual([]);
});

it("refuses a merge that would cut text", () => {
  const long = "я".repeat(600);
  let t = setCellText(setCellText(base(), { row: 1, column: 0 }, long), { row: 1, column: 1 }, long);
  expect(mergeCells(t, { row: 1, column: 0, rowSpan: 1, columnSpan: 2 })).toBe(t);
  expect(canMergeText(t, { row: 1, column: 0, rowSpan: 1, columnSpan: 2 })).toBe(false);
});

it("tidies cell text", () => {
  expect(tidyCell(" a\nb ")).toBe("a b");
  expect(setCellText(base(), { row: 1, column: 1 }, "9\n9").rows[1]![1]).toBe("9 9");
});

it("crop is integers 0 to 45 with one side above zero, and needs the attachment", () => {
  const img: ImageState = { widthPercent: 60, align: "center", landscape: false, attachmentId: "22222222-2222-4222-8222-222222222222", attachmentSha256: "a".repeat(64) };
  expect(normalizeCrop({ top: 0, left: 0, right: 0, bottom: 0 })).toBeNull();
  expect(normalizeCrop({ top: -3, left: 99, right: 2.4, bottom: 0 })).toEqual({ top: 0, left: 45, right: 2, bottom: 0 });
  const cropped = setCrop(img, { top: 0, left: 10, right: 0, bottom: 5 });
  expect(cropped.crop).toEqual({ top: 0, left: 10, right: 0, bottom: 5 });
  expect(cropInset(cropped.crop!)).toBe("0% 0% 5% 10%");
  const errors: ValidationError[] = [];
  expect(validateImage({ ...cropped, type: "image", id: ID } as never, "i", ID, errors)).not.toBeNull();
  expect(errors).toEqual([]);
  expect(clearCrop(cropped).crop).toBeUndefined();
  expect(setCrop({ ...img, attachmentId: undefined, attachmentSha256: undefined }, { top: 0, left: 5, right: 0, bottom: 0 }).crop).toBeUndefined();
});

it("width stays within 20 to 100", () => {
  expect(clampWidth(5)).toBe(20);
  expect(clampWidth(500)).toBe(100);
  expect(clampWidth(Number.NaN)).toBe(100);
  expect(stepWidth({ widthPercent: 95, align: "left", landscape: false }, 1).widthPercent).toBe(100);
});

it("uploads through the injected post and hashes the bytes", async () => {
  const file = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  const calls: string[] = [];
  const ok = await uploadImage(file, async (u) => { calls.push(u.type); return { attachmentId: "33333333-3333-4333-8333-333333333333" }; });
  expect(ok).toEqual({ ok: true, value: { attachmentId: "33333333-3333-4333-8333-333333333333", attachmentSha256: "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81" } });
  expect(calls).toEqual(["image/png"]);
  expect(await uploadImage(file, async () => ({ attachmentId: "x" }))).toEqual({ ok: false, reason: "send" });
  expect(await uploadImage(file, async () => { throw new Error("offline"); })).toEqual({ ok: false, reason: "send" });
  expect(checkFile({ type: "image/gif", size: 5 })).toBe("type");
  expect(checkFile({ type: "image/png", size: 0 })).toBe("empty");
  expect(checkFile({ type: "image/png", size: 9 * 1024 * 1024 })).toBe("size");
});

it("renders the bars in Croatian without forbidden wording", () => {
  const noop = () => {};
  const table = renderToStaticMarkup(<TableBar table={base()} cell={{ row: 0, column: 0 }} fills={["#ffe9a8"]} onAction={noop} onHeaderFill={noop} onCellFill={noop} />);
  expect(table).toContain("Dodaj redak");
  expect(table).toContain("Spoji ćelije");
  const img: ImageState = { widthPercent: 60, align: "right", landscape: false, attachmentId: "22222222-2222-4222-8222-222222222222", attachmentSha256: "a".repeat(64) };
  const bar = renderToStaticMarkup(<ImageBar image={img} onAction={noop} onAlign={noop} onWidth={noop} />);
  expect(bar).toContain("Izreži");
  expect(bar).toContain('aria-pressed="true"');
  expect(renderToStaticMarkup(<ImageBar image={{ ...img, attachmentId: undefined }} onAction={noop} onAlign={noop} onWidth={noop} />)).toContain("Odaberi sliku");
  const dialog = renderToStaticMarkup(<CropDialog src="data:," onApply={noop} onClose={noop} />);
  expect(dialog).toContain("Izreži sliku");
});
