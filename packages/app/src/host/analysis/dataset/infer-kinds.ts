import { ANALYSIS_LIMITS } from "../api/limits";
import type { AnalysisRequest } from "../api/run";
import type { DatasetError } from "./parse-csv";

/** The generated contract carries the set flat in the body (`columns`, `rows`), not under a `dataset` key as the plan table shows. */
export type Dataset = Pick<AnalysisRequest, "columns" | "rows">;
export type Cell = number | string | null;

/** A number with a point or a comma as the decimal sign; no thousands separators, no exponent, no sign-only text. */
const NUMBER = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;

/** The value of a numeric cell, or `undefined` when the text is not a plain number. `-0` becomes 0. */
export function parseNumber(text: string): number | undefined {
  if (!NUMBER.test(text)) return undefined;
  const value = Number(text.replace(",", "."));
  if (!Number.isFinite(value)) return undefined;
  return value === 0 ? 0 : value;
}

/** True when the whole row of cells is numbers: a file that starts with data and has no header row. */
export function looksLikeData(cells: readonly string[]): boolean {
  return cells.length > 0 && cells.every((cell) => parseNumber(cell.trim()) !== undefined);
}

export type Inferred = { ok: true; dataset: Dataset } | { ok: false; errors: DatasetError[] };

/**
 * Decides the kind of every column and converts the cells. A column is numeric when each filled cell is a number,
 * a category when none is; a mixture is refused at the first cell that breaks the column. An empty cell is `null`.
 * `rows` are already trimmed text; `names` the checked header.
 */
export function inferKinds(names: readonly string[], rows: readonly (readonly string[])[]): Inferred {
  const errors: DatasetError[] = [];
  const kinds: ("numeric" | "category")[] = [];
  names.forEach((name, column) => {
    let numbers = 0;
    let words = 0;
    let firstNumber: number | undefined;
    let firstWord: number | undefined;
    rows.forEach((row, index) => {
      const cell = row[column] ?? "";
      if (cell === "") return;
      if (parseNumber(cell) === undefined) {
        words += 1;
        firstWord ??= index;
        if (cell.length > ANALYSIS_LIMITS.maxCellLength) errors.push({ code: "cellTooLong", row: index + 1, column: column + 1, name });
      } else {
        numbers += 1;
        firstNumber ??= index;
      }
    });
    if (numbers > 0 && words > 0) {
      // The minority kind is reported, so the message points at the cell most likely to be the mistake.
      const index = words <= numbers ? firstWord : firstNumber;
      errors.push({ code: "mixedType", row: (index ?? 0) + 1, column: column + 1, name });
    }
    kinds.push(numbers > 0 && words === 0 ? "numeric" : "category");
  });
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    dataset: {
      columns: names.map((name, column) => ({ name, kind: kinds[column] ?? "category" })),
      rows: rows.map((row) =>
        names.map((_, column): Cell => {
          const cell = row[column] ?? "";
          if (cell === "") return null;
          return kinds[column] === "numeric" ? (parseNumber(cell) ?? null) : cell;
        })),
    },
  };
}
