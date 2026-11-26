// WEB-V18-UPITNIK-IZVOZ: the pure rules of the export page: the JSON and the CSV built on the device from the
// server's `questionnaire-export-v1` (V18-6: the server answers JSON, the web writes the CSV). Rows stay in
// the order the server gave (by digest of the response id, never by time: V18-1, V18-4). Nothing here sums,
// ranks or compares respondents.
import type { ApiResult } from "@/client/api";

export type QuestionnaireExport = Extract<ApiResult<"teacher.questionnaire-export.get">, { ok: true }>["body"];
export type Variable = QuestionnaireExport["variables"][number];

export const JSON_FILE = "upitnik-izvoz.json";
export const CSV_FILE = "upitnik-izvoz.csv";

/**
 * The least number of responses an export holds (OP-V18-4, assumption until the owner confirms the value). The
 * server decides and answers 409 below it; this copy is only for the sentence that explains the rule.
 */
export const QUESTIONNAIRE_EXPORT_MIN_RESPONSES = 5;

/** The questions whose answers are free text. */
export const textVariables = (data: QuestionnaireExport): readonly Variable[] => data.variables.filter((v) => v.kind === "text");

/** A text column is in the export only when the server says free text is included. */
export const exportedVariables = (data: QuestionnaireExport): readonly Variable[] =>
  data.includesText ? data.variables : data.variables.filter((v) => v.kind !== "text");

/** The JSON file: the server's answer as it came, two-space indented (the same answer gives the same bytes). */
export const toJson = (data: QuestionnaireExport): string => `${JSON.stringify(data, null, 2)}\n`;

const FORMULA_START = /^[=+\-@\t\r]/u;
/** A CSV cell: quoted when it holds a separator, quote or line break; a text a spreadsheet would run as a formula gets a leading apostrophe. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

/** A stored answer as one cell: nothing is an empty cell, a choice of several is its codes joined with "; ". */
export function answerCell(value: unknown): string | number {
  if (typeof value === "string" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.filter((v): v is string | number => typeof v === "string" || typeof v === "number").join("; ");
  return "";
}

const csvRow = (cells: readonly (string | number)[]): string => cells.map(csvCell).join(",");
/** UTF-8 marker so a spreadsheet reads the diacritics; rows end with CRLF (RFC 4180). */
const BOM = "﻿";

/** One row per respondent, one column per exported question; the first column is the server's `n`. */
export function toCsv(data: QuestionnaireExport, orderHead: string): string {
  const columns = exportedVariables(data);
  const head = [orderHead, ...columns.map((v) => v.label)];
  const rows = data.rows.map((r) => [r.n, ...columns.map((v) => answerCell(r.values[v.questionId]))]);
  return `${BOM}${[csvRow(head), ...rows.map(csvRow)].join("\r\n")}\r\n`;
}

export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
}

export const exportPath = (questionnaireId: string): string => `/nastavnik/upitnici/${encodeURIComponent(questionnaireId)}/izvoz`;
