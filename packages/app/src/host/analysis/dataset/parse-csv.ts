import { ANALYSIS_LIMITS, MAX_COLUMN_NAME_LENGTH } from "../api/limits";
import { inferKinds, looksLikeData, type Dataset } from "./infer-kinds";

/** Longest text the reader takes at all (characters). Generous against the body limit; stops a huge file early. */
export const MAX_CSV_LENGTH = 1_000_000;

/** `row` counts data rows from 1 (the header is row 0 and has no row number); `column` counts from 1. */
export type DatasetError = {
  code:
    | "empty" | "tooLong" | "noHeader" | "noRows" | "badQuote" | "unterminatedQuote" | "emptyName" | "nameTooLong"
    | "duplicateName" | "tooManyColumns" | "tooManyRows" | "cellCount" | "cellTooLong" | "mixedType" | "bodyTooLarge";
  row?: number;
  column?: number;
  name?: string;
};

export type ParsedDataset = { ok: true; dataset: Dataset } | { ok: false; errors: DatasetError[] };

type Records = { ok: true; records: string[][] } | { ok: false; error: DatasetError };

/** `;` when the first line has one (as the roster import), otherwise `,`. Quoted text is skipped. */
function detectSeparator(text: string): ";" | "," {
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char === ";") return ";";
  }
  return ",";
}

/** RFC 4180 reading: quotes may hold separators and line breaks, `""` is a quote; blank lines are skipped. */
function readRecords(text: string, separator: ";" | ","): Records {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let wasQuoted = false;
  let started = false;
  const endField = () => {
    record.push(field);
    field = "";
    wasQuoted = false;
  };
  const endRecord = () => {
    endField();
    const blank = record.length === 1 && record[0]!.trim() === "" && !started;
    if (!blank) records.push(record);
    record = [];
    started = false;
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = false;
      continue;
    }
    if (char === '"') {
      if (field.trim() !== "" || wasQuoted) return { ok: false, error: { code: "badQuote", row: records.length } };
      quoted = true;
      wasQuoted = true;
      started = true;
      field = "";
    } else if (char === separator) { started = true; endField(); }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      endRecord();
    } else {
      if (wasQuoted && char.trim() !== "") return { ok: false, error: { code: "badQuote", row: records.length } };
      field += char;
    }
  }
  if (quoted) return { ok: false, error: { code: "unterminatedQuote", row: records.length } };
  if (field !== "" || record.length > 0 || started) endRecord();
  return { ok: true, records };
}

/**
 * Reads CSV text (a file or pasted text) into a data set for the analysis body: UTF-8 with or without BOM, `;` or `,`,
 * RFC 4180 quotes, first row the header, number columns with a point or comma decimal sign, anything else a category,
 * an empty cell `null`. Never throws: a bad input is a list of errors by row and column. Nothing leaves the browser here.
 */
export function parseDataset(input: string): ParsedDataset {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (text.length > MAX_CSV_LENGTH) return { ok: false, errors: [{ code: "tooLong" }] };
  if (text.trim() === "") return { ok: false, errors: [{ code: "empty" }] };
  const read = readRecords(text, detectSeparator(text.trimStart()));
  if (!read.ok) return { ok: false, errors: [read.error] };
  const [header, ...body] = read.records;
  if (header === undefined) return { ok: false, errors: [{ code: "empty" }] };
  if (looksLikeData(header)) return { ok: false, errors: [{ code: "noHeader" }] };
  const errors: DatasetError[] = [];
  const names = header.map((cell) => cell.trim());
  if (names.length > ANALYSIS_LIMITS.maxColumns) errors.push({ code: "tooManyColumns", column: ANALYSIS_LIMITS.maxColumns + 1 });
  const seen = new Set<string>();
  names.forEach((name, index) => {
    if (name === "") errors.push({ code: "emptyName", column: index + 1 });
    else if (name.length > MAX_COLUMN_NAME_LENGTH) errors.push({ code: "nameTooLong", column: index + 1, name });
    else if (seen.has(name)) errors.push({ code: "duplicateName", column: index + 1, name });
    seen.add(name);
  });
  if (body.length === 0 && errors.length === 0) return { ok: false, errors: [{ code: "noRows" }] };
  if (body.length > ANALYSIS_LIMITS.maxRows) errors.push({ code: "tooManyRows", row: ANALYSIS_LIMITS.maxRows + 1 });
  body.forEach((record, index) => {
    if (index < ANALYSIS_LIMITS.maxRows && record.length !== names.length) {
      errors.push({ code: "cellCount", row: index + 1, column: Math.min(record.length, names.length) + 1 });
    }
  });
  if (errors.length > 0) return { ok: false, errors };
  const inferred = inferKinds(names, body.map((record) => record.map((cell) => cell.trim())));
  if (!inferred.ok) return inferred;
  // The body limit is on the request JSON; the data set is the bulk of it, so a set over it cannot be sent.
  if (new TextEncoder().encode(JSON.stringify(inferred.dataset)).length > ANALYSIS_LIMITS.maxBodyBytes) {
    return { ok: false, errors: [{ code: "bodyTooLarge" }] };
  }
  return inferred;
}
