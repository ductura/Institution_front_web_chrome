// WEB-V14-SHEET-JOURNAL (val 14): client mirror of the spreadsheet step module of
// the server (server/domain/sheet/model/steps.ts, edit-step.ts, step-hash.ts,
// SRV-V14-SHEET-EVIDENCE). The serialised editing step of a spreadsheet document,
// format `ductus-sheet-steps-v1`, its reader and its application. Pure: no clock,
// no I/O. The editor's capture and the server's replayer read steps through the
// same rules, so neither accepts a shape the other refuses.
//
// Rules, as for the text and slide steps:
//   - every object has a closed set of keys: an unknown field, `__proto__` and any
//     time field have nowhere to sit;
//   - an unknown step type is refused (`unknown_step`), never skipped;
//   - a step that replaces or removes content carries the SHA-256 of what it
//     replaces or removes, so nothing is changed silently;
//   - the result of every step is checked by `validateSheetDocument`;
//   - application is atomic: the input is never changed, a refused step leaves no
//     trace, nothing is repaired.
// Hashing is WebCrypto (as for slides), so application is async.
// Assumption (as on the server): inserting or removing a row or a column moves the
// cells only; the text of a formula is not rewritten.
import { canonicalizeJcs } from "../document/forensics/jcs";
import { hasOnlyKeys, isPlainObject, ownProperty } from "../document/json";

import {
  MAX_FORMULA_LENGTH,
  MAX_SHEET_COLUMNS,
  MAX_SHEET_ROWS,
  SHEET_SCHEMA_VERSION,
  formatCellRef,
  parseCellRef,
  type Sheet,
  type SheetCell,
  type SheetDocument,
} from "./model";
import { validateSheetDocument } from "./validate";

/** Value of `captureContext.transactionFormat` for spreadsheet documents. */
export const SHEET_STEP_FORMAT_V1 = "ductus-sheet-steps-v1" as const;

export const SHEET_STEP_TYPES = [
  "cellSet", "cellClear", "rowInsert", "rowRemove", "columnInsert", "columnRemove", "sheetRename",
] as const;
export type SheetStepType = (typeof SHEET_STEP_TYPES)[number];

/** Most steps in the array of one event (as for slides). */
export const MAX_SHEET_STEPS_PER_EVENT = 1000;
/** Most UTF-8 bytes of the array of one event, as for a whole segment (2 MiB). */
export const MAX_SHEET_STEPS_BYTES = 2_097_152;
/** Most UTF-8 bytes of a snapshot of a spreadsheet document (2 MiB). */
export const MAX_SHEET_SNAPSHOT_BYTES = 2 * 1024 * 1024;

export type CellSetStep = {
  type: "cellSet"; sheetId: string; ref: string; value?: string | number; formula?: string; replacedSha256?: string;
};
export type CellClearStep = { type: "cellClear"; sheetId: string; ref: string; removedSha256: string };
export type RowInsertStep = { type: "rowInsert"; sheetId: string; row: number };
export type RowRemoveStep = { type: "rowRemove"; sheetId: string; row: number; removedSha256: string };
export type ColumnInsertStep = { type: "columnInsert"; sheetId: string; column: number };
export type ColumnRemoveStep = { type: "columnRemove"; sheetId: string; column: number; removedSha256: string };
export type SheetRenameStep = { type: "sheetRename"; sheetId: string; name: string; replacedSha256: string };

export type SheetStep =
  | CellSetStep | CellClearStep | RowInsertStep | RowRemoveStep | ColumnInsertStep | ColumnRemoveStep | SheetRenameStep;

export type SheetStepErrorCode = "not_an_object" | "unknown_step" | "step_invalid" | "too_many_steps" | "too_large";
export type SheetStepParse = { ok: true; step: SheetStep } | { ok: false; error: SheetStepErrorCode };
export type SheetStepsParse = { ok: true; steps: SheetStep[] } | { ok: false; error: SheetStepErrorCode; index?: number };

const KEYS: Readonly<Record<SheetStepType, ReadonlySet<string>>> = {
  cellSet: new Set(["type", "sheetId", "ref", "value", "formula", "replacedSha256"]),
  cellClear: new Set(["type", "sheetId", "ref", "removedSha256"]),
  rowInsert: new Set(["type", "sheetId", "row"]),
  rowRemove: new Set(["type", "sheetId", "row", "removedSha256"]),
  columnInsert: new Set(["type", "sheetId", "column"]),
  columnRemove: new Set(["type", "sheetId", "column", "removedSha256"]),
  sheetRename: new Set(["type", "sheetId", "name", "replacedSha256"]),
};

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
// Lowercase RFC 4122 text, as on the server: an uppercase id is refused, not folded.
const SHEET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const isSha256 = (v: unknown): v is string => typeof v === "string" && SHA256_PATTERN.test(v);
const isSheetId = (v: unknown): v is string => typeof v === "string" && SHEET_ID_PATTERN.test(v);
const isWellFormed = (v: string): boolean => !/\p{Cs}/u.test(v);
const isPosition = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 1;
// As on the server a reference names a cell of the largest possible grid (A1 to Z200).
const isRef = (v: unknown): v is string => {
  const at = typeof v === "string" ? parseCellRef(v) : null;
  return at !== null && at.row <= MAX_SHEET_ROWS && at.column <= MAX_SHEET_COLUMNS;
};

/** Reads one step. An accepted step is a fresh copy with known fields only. */
export function parseSheetStep(raw: unknown): SheetStepParse {
  if (!isPlainObject(raw)) return { ok: false, error: "not_an_object" };
  const type = ownProperty(raw, "type");
  if (typeof type !== "string" || !(SHEET_STEP_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "unknown_step" };
  }
  const kind = type as SheetStepType;
  const bad = { ok: false, error: "step_invalid" } as const;
  if (!hasOnlyKeys(raw, KEYS[kind])) return bad;
  const sheetId = ownProperty(raw, "sheetId");
  if (!isSheetId(sheetId)) return bad;
  const get = (key: string): unknown => ownProperty(raw, key);

  switch (kind) {
    case "cellSet": {
      const ref = get("ref");
      if (!isRef(ref)) return bad;
      const hasValue = Object.hasOwn(raw, "value");
      const hasFormula = Object.hasOwn(raw, "formula");
      if (hasValue === hasFormula) return bad; // exactly one of the two
      const value = get("value");
      const formula = get("formula");
      if (hasValue) {
        if (typeof value === "number") {
          if (!Number.isFinite(value)) return bad;
        } else if (typeof value !== "string" || !isWellFormed(value)) return bad;
      } else if (typeof formula !== "string" || !isWellFormed(formula) || Array.from(formula).length > MAX_FORMULA_LENGTH) {
        return bad;
      }
      const hasHash = Object.hasOwn(raw, "replacedSha256");
      const replaced = get("replacedSha256");
      if (hasHash && !isSha256(replaced)) return bad;
      return { ok: true, step: {
        type: kind, sheetId, ref,
        ...(hasValue ? { value: value as string | number } : { formula: formula as string }),
        ...(hasHash ? { replacedSha256: replaced as string } : {}),
      } };
    }
    case "cellClear": {
      const ref = get("ref"); const removed = get("removedSha256");
      if (!isRef(ref) || !isSha256(removed)) return bad;
      return { ok: true, step: { type: kind, sheetId, ref, removedSha256: removed } };
    }
    case "rowInsert": {
      const row = get("row");
      return isPosition(row) ? { ok: true, step: { type: kind, sheetId, row } } : bad;
    }
    case "rowRemove": {
      const row = get("row"); const removed = get("removedSha256");
      return isPosition(row) && isSha256(removed) ? { ok: true, step: { type: kind, sheetId, row, removedSha256: removed } } : bad;
    }
    case "columnInsert": {
      const column = get("column");
      return isPosition(column) ? { ok: true, step: { type: kind, sheetId, column } } : bad;
    }
    case "columnRemove": {
      const column = get("column"); const removed = get("removedSha256");
      return isPosition(column) && isSha256(removed) ? { ok: true, step: { type: kind, sheetId, column, removedSha256: removed } } : bad;
    }
    case "sheetRename": {
      const name = get("name"); const replaced = get("replacedSha256");
      if (typeof name !== "string" || !isWellFormed(name) || !isSha256(replaced)) return bad;
      return { ok: true, step: { type: kind, sheetId, name, replacedSha256: replaced } };
    }
  }
}

/** Reads the array of one event: 1 to `MAX_SHEET_STEPS_PER_EVENT` steps, within `MAX_SHEET_STEPS_BYTES`. */
export function parseSheetSteps(raw: unknown): SheetStepsParse {
  if (!Array.isArray(raw) || raw.length < 1) return { ok: false, error: "step_invalid" };
  if (raw.length > MAX_SHEET_STEPS_PER_EVENT) return { ok: false, error: "too_many_steps" };
  for (let index = 0; index < raw.length; index += 1) {
    if (!Object.hasOwn(raw, index)) return { ok: false, error: "step_invalid", index };
  }
  const steps: SheetStep[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const parsed = parseSheetStep(raw[index]);
    if (!parsed.ok) return { ok: false, error: parsed.error, index };
    steps.push(parsed.step);
  }
  if (new TextEncoder().encode(canonicalizeJcs(steps as never)).byteLength > MAX_SHEET_STEPS_BYTES) {
    return { ok: false, error: "too_large" };
  }
  return { ok: true, steps };
}

// ---------------------------------------------------------------- hashes

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 (lowercase hex) of the UTF-8 bytes of a text; the `replacedSha256` of a sheet name. */
export async function sheetTextSha256(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) throw new Error("sheet: Web Crypto unavailable");
  return hex(new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(text) as BufferSource)));
}
/** SHA-256 of the JCS text of a cell: the `replacedSha256` and `removedSha256` of a cell step. */
export const sheetCellSha256 = (cell: SheetCell): Promise<string> => sheetTextSha256(canonicalizeJcs(cell as never));
/** SHA-256 of the JCS text of a map of cells: the `removedSha256` of a row or column removal. */
export const sheetCellsSha256 = (cells: Record<string, SheetCell>): Promise<string> =>
  sheetTextSha256(canonicalizeJcs(cells as never));
/** SHA-256 of the JCS text of a document (the evidence document hash). */
export const sheetDocumentSha256 = (doc: SheetDocument): Promise<string> => sheetTextSha256(canonicalizeJcs(doc as never));

// ---------------------------------------------------------------- revision 0

/** Fixed id of the one sheet of revision 0, as on the server. */
export const SHEET_REVISION_ZERO_SHEET_ID = "00000000-0000-4000-8000-000000000000";

/** Revision 0 of every spreadsheet work: one empty sheet "List1" of 100 rows and 10 columns. */
export function sheetRevisionZeroDocument(): SheetDocument {
  return {
    schemaVersion: SHEET_SCHEMA_VERSION, kind: "spreadsheet",
    sheets: [{ id: SHEET_REVISION_ZERO_SHEET_ID, name: "List1", rows: 100, columns: 10, cells: {} }],
  };
}

/** SHA-256 of the JCS text of revision 0 (a constant of the server, one for every spreadsheet work). */
export const SHEET_REVISION_ZERO_SHA256 = "70f7ffa27faf9f771316120c2b2f94e351aed32af3b94177d4c85ff56b0066e4";

// ---------------------------------------------------------------- application

export type ApplySheetStepErrorCode =
  | "document_invalid" | "sheet_not_found" | "cell_out_of_grid" | "index_out_of_range"
  | "hash_mismatch" | "no_change" | "result_invalid" | "too_large";
export type ApplySheetStep = { ok: true; doc: SheetDocument } | { ok: false; error: ApplySheetStepErrorCode };
export type ApplySheetSteps = { ok: true; doc: SheetDocument } | { ok: false; error: ApplySheetStepErrorCode; index: number };

type Fail = { error: ApplySheetStepErrorCode };
const fail = (error: ApplySheetStepErrorCode): Fail => ({ error });

const refOf = (column: number, row: number): string | null =>
  column < 1 || column > MAX_SHEET_COLUMNS || row < 1 || row > MAX_SHEET_ROWS ? null : formatCellRef({ column, row });

function lineCells(sheet: Sheet, axis: "row" | "column", position: number): Record<string, SheetCell> {
  const out: Record<string, SheetCell> = {};
  for (const [ref, cell] of Object.entries(sheet.cells)) {
    const at = parseCellRef(ref)!;
    if ((axis === "row" ? at.row : at.column) === position) out[ref] = cell;
  }
  return out;
}

function shiftCells(sheet: Sheet, axis: "row" | "column", position: number, delta: 1 | -1): void {
  const next: Record<string, SheetCell> = {};
  for (const [ref, cell] of Object.entries(sheet.cells)) {
    const at = parseCellRef(ref)!;
    const coordinate = axis === "row" ? at.row : at.column;
    if (delta === -1 && coordinate === position) continue;
    const moved = coordinate >= position ? coordinate + delta : coordinate;
    const target = axis === "row" ? refOf(at.column, moved) : refOf(moved, at.row);
    if (target !== null) next[target] = cell;
  }
  sheet.cells = next;
}

async function mutate(doc: SheetDocument, step: SheetStep): Promise<Fail | null> {
  const sheet = doc.sheets.find((candidate) => candidate.id === step.sheetId);
  if (sheet === undefined) return fail("sheet_not_found");
  switch (step.type) {
    case "cellSet": {
      const at = parseCellRef(step.ref)!;
      if (at.row > sheet.rows || at.column > sheet.columns) return fail("cell_out_of_grid");
      const old = Object.hasOwn(sheet.cells, step.ref) ? sheet.cells[step.ref]! : undefined;
      if ((old !== undefined) !== (step.replacedSha256 !== undefined)) return fail("hash_mismatch");
      if (old !== undefined && (await sheetCellSha256(old)) !== step.replacedSha256) return fail("hash_mismatch");
      const cell: SheetCell = step.formula !== undefined
        ? { value: null, formula: step.formula } : { value: step.value as string | number };
      if (old !== undefined && old.formula === cell.formula && Object.is(old.value, cell.value)) return fail("no_change");
      sheet.cells[step.ref] = cell;
      return null;
    }
    case "cellClear": {
      const at = parseCellRef(step.ref)!;
      if (at.row > sheet.rows || at.column > sheet.columns) return fail("cell_out_of_grid");
      const old = Object.hasOwn(sheet.cells, step.ref) ? sheet.cells[step.ref]! : undefined;
      if (old === undefined) return fail("no_change");
      if ((await sheetCellSha256(old)) !== step.removedSha256) return fail("hash_mismatch");
      delete sheet.cells[step.ref];
      return null;
    }
    case "rowInsert": {
      if (step.row > sheet.rows + 1 || sheet.rows + 1 > MAX_SHEET_ROWS) return fail("index_out_of_range");
      shiftCells(sheet, "row", step.row, 1);
      sheet.rows += 1;
      return null;
    }
    case "rowRemove": {
      if (step.row > sheet.rows) return fail("index_out_of_range");
      if ((await sheetCellsSha256(lineCells(sheet, "row", step.row))) !== step.removedSha256) return fail("hash_mismatch");
      shiftCells(sheet, "row", step.row, -1);
      sheet.rows -= 1;
      return null;
    }
    case "columnInsert": {
      if (step.column > sheet.columns + 1 || sheet.columns + 1 > MAX_SHEET_COLUMNS) return fail("index_out_of_range");
      shiftCells(sheet, "column", step.column, 1);
      sheet.columns += 1;
      return null;
    }
    case "columnRemove": {
      if (step.column > sheet.columns) return fail("index_out_of_range");
      if ((await sheetCellsSha256(lineCells(sheet, "column", step.column))) !== step.removedSha256) return fail("hash_mismatch");
      shiftCells(sheet, "column", step.column, -1);
      sheet.columns -= 1;
      return null;
    }
    case "sheetRename": {
      if ((await sheetTextSha256(sheet.name)) !== step.replacedSha256) return fail("hash_mismatch");
      if (sheet.name === step.name) return fail("no_change");
      sheet.name = step.name;
      return null;
    }
  }
}

/** Applies one step. The input document is never changed; the result is always a valid document within the snapshot limit. */
export async function applySheetStep(doc: SheetDocument, step: SheetStep): Promise<ApplySheetStep> {
  const valid = validateSheetDocument(doc);
  if (!valid.ok) return { ok: false, error: "document_invalid" };
  const draft = structuredClone(valid.value);
  const refused = await mutate(draft, step);
  if (refused !== null) return { ok: false, error: refused.error };
  const checked = validateSheetDocument(draft);
  if (!checked.ok) return { ok: false, error: "result_invalid" };
  if (new TextEncoder().encode(canonicalizeJcs(checked.value as never)).byteLength > MAX_SHEET_SNAPSHOT_BYTES) {
    return { ok: false, error: "too_large" };
  }
  return { ok: true, doc: checked.value };
}

/** Applies the steps of one event in order; the first refused step refuses all, with its index. */
export async function applySheetSteps(doc: SheetDocument, steps: readonly SheetStep[]): Promise<ApplySheetSteps> {
  let current = doc;
  for (let index = 0; index < steps.length; index += 1) {
    const applied = await applySheetStep(current, steps[index]!);
    if (!applied.ok) return { ok: false, error: applied.error, index };
    current = applied.doc;
  }
  return { ok: true, doc: current };
}

// ---------------------------------------------------------------- snapshot

/** UTF-8 bytes of the JCS text of a document: what is hashed, signed and sent. */
export function sheetSnapshotBytes(doc: SheetDocument): Uint8Array {
  return new TextEncoder().encode(canonicalizeJcs(doc as never));
}

export type SheetSnapshotVerification =
  | { ok: true; document: SheetDocument; text: string; sha256: string }
  | { ok: false; reason: "too_large" | "invalid" };

/**
 * A snapshot is accepted only as the exact JCS bytes of a valid spreadsheet
 * document (strict UTF-8, no byte order mark, canonical form identical to the
 * received text), as for slides.
 */
export async function verifySheetSnapshot(bytes: Uint8Array): Promise<SheetSnapshotVerification> {
  if (!(bytes instanceof Uint8Array)) return { ok: false, reason: "invalid" };
  if (bytes.byteLength > MAX_SHEET_SNAPSHOT_BYTES) return { ok: false, reason: "too_large" };
  const received = new Uint8Array(bytes);
  let text: string;
  let parsed: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(received);
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  let valid: ReturnType<typeof validateSheetDocument>;
  let canonical: string;
  try {
    valid = validateSheetDocument(parsed);
    if (!valid.ok) return { ok: false, reason: "invalid" };
    canonical = canonicalizeJcs(valid.value as never);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (canonical !== text) return { ok: false, reason: "invalid" };
  return { ok: true, document: valid.value, text, sha256: await sheetTextSha256(text) };
}
