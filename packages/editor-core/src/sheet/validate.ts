/**
 * Validator for SheetDocument v1. Strict: unknown fields are rejected at every
 * level (as B-8 does for the text model). Returns a typed result instead of
 * throwing; `path` points at the first problem found.
 */
import {
  MAX_CELL_TEXT_LENGTH,
  MAX_FORMULA_LENGTH,
  MAX_SHEETS,
  MAX_SHEET_COLUMNS,
  MAX_SHEET_FILLED_CELLS,
  MAX_SHEET_ID_LENGTH,
  MAX_SHEET_NAME_LENGTH,
  MAX_SHEET_ROWS,
  SHEET_SCHEMA_VERSION,
  isFilledCell,
  parseCellRef,
  type Sheet,
  type SheetCell,
  type SheetDocument,
} from "./model.ts";

export type SheetValidationCode =
  | "not_object"
  | "unknown_field"
  | "missing_field"
  | "bad_schema_version"
  | "bad_kind"
  | "bad_sheets"
  | "too_many_sheets"
  | "bad_sheet_id"
  | "duplicate_sheet_id"
  | "bad_sheet_name"
  | "duplicate_sheet_name"
  | "bad_dimension"
  | "bad_cell_ref"
  | "cell_out_of_bounds"
  | "bad_cell"
  | "bad_cell_value"
  | "bad_formula"
  | "empty_cell_stored"
  | "too_many_cells";

export type SheetValidationResult =
  | { ok: true; value: SheetDocument }
  | { ok: false; code: SheetValidationCode; path: string };

class Invalid extends Error {
  constructor(
    readonly code: SheetValidationCode,
    readonly path: string,
  ) {
    super(`${code} at ${path}`);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = text.charCodeAt(i + 1);
      if (n >= 0xdc00 && n <= 0xdfff) i += 1;
      else return true;
    } else if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
}

function exactKeys(
  obj: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(obj)) {
    if (!required.includes(key) && !optional.includes(key)) {
      throw new Invalid("unknown_field", `${path}.${key}`);
    }
  }
  for (const key of required) {
    if (!(key in obj)) throw new Invalid("missing_field", `${path}.${key}`);
  }
}

function checkText(text: string, max: number, path: string, code: SheetValidationCode): void {
  if (text.length > max || hasLoneSurrogate(text)) throw new Invalid(code, path);
}

function checkCell(raw: unknown, path: string): SheetCell {
  if (!isRecord(raw)) throw new Invalid("bad_cell", path);
  exactKeys(raw, ["value"], ["formula"], path);
  const value = raw.value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Invalid("bad_cell_value", `${path}.value`);
  } else if (typeof value === "string") {
    checkText(value, MAX_CELL_TEXT_LENGTH, `${path}.value`, "bad_cell_value");
  } else if (value !== null) {
    throw new Invalid("bad_cell_value", `${path}.value`);
  }
  if ("formula" in raw) {
    const formula = raw.formula;
    if (
      typeof formula !== "string" ||
      !formula.startsWith("=") ||
      formula.length < 2 ||
      formula.length > MAX_FORMULA_LENGTH ||
      hasLoneSurrogate(formula)
    ) {
      throw new Invalid("bad_formula", `${path}.formula`);
    }
  }
  const cell = raw as unknown as SheetCell;
  if (!isFilledCell(cell)) throw new Invalid("empty_cell_stored", path);
  return cell;
}

function checkSheet(raw: unknown, path: string): Sheet {
  if (!isRecord(raw)) throw new Invalid("bad_sheets", path);
  exactKeys(raw, ["id", "name", "rows", "columns", "cells"], [], path);
  const { id, name, rows, columns, cells } = raw;
  if (typeof id !== "string" || id.length < 1) throw new Invalid("bad_sheet_id", `${path}.id`);
  checkText(id, MAX_SHEET_ID_LENGTH, `${path}.id`, "bad_sheet_id");
  if (typeof name !== "string" || name.length < 1 || name.trim() !== name) {
    throw new Invalid("bad_sheet_name", `${path}.name`);
  }
  checkText(name, MAX_SHEET_NAME_LENGTH, `${path}.name`, "bad_sheet_name");
  if (!Number.isInteger(rows) || (rows as number) < 1 || (rows as number) > MAX_SHEET_ROWS) {
    throw new Invalid("bad_dimension", `${path}.rows`);
  }
  if (
    !Number.isInteger(columns) ||
    (columns as number) < 1 ||
    (columns as number) > MAX_SHEET_COLUMNS
  ) {
    throw new Invalid("bad_dimension", `${path}.columns`);
  }
  if (!isRecord(cells)) throw new Invalid("bad_cell", `${path}.cells`);
  for (const [ref, cell] of Object.entries(cells)) {
    const cellPath = `${path}.cells.${ref}`;
    const pos = parseCellRef(ref);
    if (pos === null) throw new Invalid("bad_cell_ref", cellPath);
    if (pos.row > (rows as number) || pos.column > (columns as number)) {
      throw new Invalid("cell_out_of_bounds", cellPath);
    }
    checkCell(cell, cellPath);
  }
  return raw as unknown as Sheet;
}

export function validateSheetDocument(input: unknown): SheetValidationResult {
  try {
    if (!isRecord(input)) throw new Invalid("not_object", "$");
    exactKeys(input, ["schemaVersion", "kind", "sheets"], [], "$");
    if (input.schemaVersion !== SHEET_SCHEMA_VERSION) {
      throw new Invalid("bad_schema_version", "$.schemaVersion");
    }
    if (input.kind !== "spreadsheet") throw new Invalid("bad_kind", "$.kind");
    const sheets = input.sheets;
    if (!Array.isArray(sheets) || sheets.length < 1) throw new Invalid("bad_sheets", "$.sheets");
    if (sheets.length > MAX_SHEETS) throw new Invalid("too_many_sheets", "$.sheets");
    const ids = new Set<string>();
    const names = new Set<string>();
    let filled = 0;
    sheets.forEach((rawSheet, i) => {
      const path = `$.sheets[${i}]`;
      const sheet = checkSheet(rawSheet, path);
      if (ids.has(sheet.id)) throw new Invalid("duplicate_sheet_id", `${path}.id`);
      ids.add(sheet.id);
      // Assumption: names are unique ignoring case, as in spreadsheet tools.
      const folded = sheet.name.toLowerCase();
      if (names.has(folded)) throw new Invalid("duplicate_sheet_name", `${path}.name`);
      names.add(folded);
      filled += Object.keys(sheet.cells).length;
    });
    if (filled > MAX_SHEET_FILLED_CELLS) throw new Invalid("too_many_cells", "$.sheets");
    return { ok: true, value: input as unknown as SheetDocument };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, code: error.code, path: error.path };
    throw error;
  }
}
