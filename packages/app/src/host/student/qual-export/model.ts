// WEB-V18-KODIRANJE-IZVOZ: the pure rules of the export page: the counts in the order of the codebook, never by
// size (V18-8), and the JSON and CSV files built on the device from the server's `qualitative-export-v1`
// (V18-6: the server answers JSON, the web writes the CSV).
import type { ApiResult } from "@/client/api";

export type QualExport = Extract<ApiResult<"student.qual-export.get">, { ok: true }>["body"];
export type CodeCount = { readonly code: string; readonly name: string; readonly description: string; readonly n: number };

export const JSON_FILE = "kodiranje-izvoz.json";
export const CSV_SEGMENTS_FILE = "kodiranje-odlomci.csv";
export const CSV_CODEBOOK_FILE = "kodiranje-sifrarnik.csv";

/** One entry per code of the codebook, in the codebook's order; a code without a segment counts 0. Counts of a code the codebook does not hold are left out. */
export function countsByCode(data: QualExport): readonly CodeCount[] {
  const totals = new Map<string, number>();
  for (const c of data.counts) totals.set(c.code, (totals.get(c.code) ?? 0) + c.n);
  return data.codebook.map((c) => ({ code: c.code, name: c.name, description: c.description, n: totals.get(c.code) ?? 0 }));
}

export const totalSegments = (data: QualExport): number => data.segments.length;

/** The JSON file: the server's answer as it came, two-space indented (the same answer gives the same bytes). */
export const toJson = (data: QualExport): string => `${JSON.stringify(data, null, 2)}\n`;

const FORMULA_START = /^[=+\-@\t\r]/u;
/** A CSV cell: quoted when it holds a separator, quote or line break; a cell a spreadsheet would run as a formula gets a leading apostrophe. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

const csvRow = (cells: readonly (string | number)[]): string => cells.map(csvCell).join(",");
/** UTF-8 marker so a spreadsheet reads the diacritics; rows end with CRLF (RFC 4180). */
const BOM = "﻿";
const csv = (head: readonly string[], rows: readonly (readonly (string | number)[])[]): string =>
  `${BOM}${[csvRow(head), ...rows.map(csvRow)].join("\r\n")}\r\n`;

/** One row per marked passage, in the server's order (codebook, then material); the code's name comes from the codebook. */
export function toSegmentsCsv(data: QualExport, head: readonly string[]): string {
  const names = new Map(data.codebook.map((c) => [c.code, c.name]));
  return csv(head, data.segments.map((s) => [s.code, names.get(s.code) ?? "", s.material, s.paragraph, s.start, s.end, s.quote, s.memo ?? ""]));
}

/** One row per code, in the codebook's order. */
export function toCodebookCsv(data: QualExport, head: readonly string[]): string {
  return csv(head, countsByCode(data).map((c) => [c.code, c.name, c.description, c.n]));
}

export function countText(n: number, forms: { one: string; few: string; many: string }): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const form = mod10 === 1 && mod100 !== 11 ? forms.one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? forms.few : forms.many;
  return form.replace("{n}", String(n));
}
