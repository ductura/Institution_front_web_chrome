// WEB-V14-SHEET-SUBMIT: what the student's step "Prije predaje" and the receipt say about a spreadsheet work:
// the kind, how many sheets and how many filled cells. Counts only: no mark, no rank, no judgement.
import {
  canonicalSheetDocument,
  countFilledCells,
  validateSheetDocument,
  type SheetDocument,
} from "../../../../../../editor-core/src/sheet/index.ts";

export type SheetSummary = {
  readonly sheets: number;
  readonly filledCells: number;
  readonly formulas: number;
};

export function summarizeSheet(doc: SheetDocument): SheetSummary {
  let formulas = 0;
  for (const sheet of doc.sheets) {
    for (const cell of Object.values(sheet.cells)) if (cell.formula !== undefined) formulas += 1;
  }
  return { sheets: doc.sheets.length, filledCells: countFilledCells(doc), formulas };
}

/**
 * The server's `document` (base64 of the canonical JSON) becomes a summary only when it decodes, is a valid
 * spreadsheet document and is exactly its own canonical form; anything else is null (shown as "unavailable").
 */
export function summaryOfDocument(base64: string): SheetSummary | null {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const checked = validateSheetDocument(JSON.parse(text));
    if (!checked.ok || canonicalSheetDocument(checked.value) !== text) return null;
    return summarizeSheet(checked.value);
  } catch {
    return null;
  }
}

/** Croatian plural for "list" (1 list, 2-4 lista, 5+ listova) and "ćelija". */
export function sheetsWord(n: number, words: { one: string; few: string; many: string }): string {
  return n === 1 ? words.one : n >= 2 && n <= 4 ? words.few : words.many;
}
