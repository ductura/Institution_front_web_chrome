/**
 * Strict A1 reference parsing for formulas. The formula engine treats a row
 * above MAX_SHEET_ROWS as not a reference (the server's parseCellRef does the
 * same), so "A201" and "A1:Z400" are `#REF!` here and not an oversized range.
 * model.ts parseCellRef stays as it is: it is outside this lane.
 */
import { MAX_SHEET_ROWS, parseCellRef as parseModelRef, type CellPosition } from "../model.ts";

export function parseCellRef(ref: string): CellPosition | null {
  const at = parseModelRef(ref);
  return at === null || at.row > MAX_SHEET_ROWS ? null : at;
}
